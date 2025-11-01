import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

/**
 * Cloud callable function to request AI assistance for a GitHub issue
 * 
 * This function:
 * 1. Validates user authentication
 * 2. Creates a job document in Firestore at /repos/{repoId}/mcp_jobs/{autoId}
 * 3. Calls the MCP endpoint to generate code
 * 4. Returns the job ID and status to the client
 */
export const requestAIForIssue = functions.https.onCall(async (data, context) => {
  // Validate authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to request AI assistance"
    );
  }

  const uid = context.auth.uid;

  // Validate required parameters
  const { repoId, issueId, issueNumber, owner, repo, relatedFiles } = data;

  if (!repoId || !issueId || !issueNumber || !owner || !repo) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required parameters: repoId, issueId, issueNumber, owner, repo"
    );
  }

  try {
    // Create job document in Firestore
    const jobRef = db.collection("repos").doc(repoId).collection("mcp_jobs").doc();
    const jobId = jobRef.id;

    const jobData = {
      issueId,
      issueNumber,
      owner,
      repo,
      requested_by: uid,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(relatedFiles && { relatedFiles }),
    };

    await jobRef.set(jobData);

    functions.logger.info("Created MCP job", {
      jobId,
      repoId,
      issueNumber,
      uid,
    });

    // Get MCP URL from environment config
    const mcpUrl = functions.config().mcp?.url || process.env.MCP_URL;

    if (!mcpUrl) {
      functions.logger.error("MCP_URL not configured");
      await jobRef.update({
        status: "failed",
        error: "MCP_URL not configured",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new functions.https.HttpsError(
        "internal",
        "MCP service URL not configured"
      );
    }

    // Call MCP endpoint asynchronously (don't wait for completion)
    const mcpEndpoint = `${mcpUrl}/api/mcp/generate-code`;
    
    // Fire and forget - make the request but don't await
    fetch(mcpEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        owner,
        repo,
        issue_number: issueNumber,
        jobId,
        requested_by: uid,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          functions.logger.error("MCP endpoint returned error", {
            status: response.status,
            statusText: response.statusText,
          });
          return jobRef.update({
            status: "failed",
            error: `MCP endpoint error: ${response.statusText}`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        functions.logger.info("MCP endpoint called successfully", { jobId });
        return null;
      })
      .catch((error) => {
        functions.logger.error("Failed to call MCP endpoint", {
          error: error.message,
          jobId,
        });
        return jobRef.update({
          status: "failed",
          error: error.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

    // Return immediately with job info
    return {
      success: true,
      jobId,
      status: "pending",
      message: "AI code generation request submitted successfully",
      issueId,
      mcpEndpoint,
    };
  } catch (error: any) {
    functions.logger.error("Error creating MCP job", {
      error: error.message,
      uid,
      repoId,
      issueNumber,
    });

    throw new functions.https.HttpsError(
      "internal",
      `Failed to create MCP job: ${error.message}`
    );
  }
});

/**
 * HTTP endpoint for health check
 */
export const healthCheck = functions.https.onRequest((req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "hackspire-functions",
  });
});

/**
 * Firestore trigger to monitor MCP job status changes
 * Logs job status updates for debugging and monitoring
 */
export const onMCPJobUpdate = functions.firestore
  .document("repos/{repoId}/mcp_jobs/{jobId}")
  .onUpdate((change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    const { repoId, jobId } = context.params;

    if (before.status !== after.status) {
      functions.logger.info("MCP job status changed", {
        repoId,
        jobId,
        oldStatus: before.status,
        newStatus: after.status,
        issueNumber: after.issueNumber,
      });

      // You can add additional logic here, such as:
      // - Send notifications to users
      // - Update related documents
      // - Trigger webhooks
    }

    return null;
  });
