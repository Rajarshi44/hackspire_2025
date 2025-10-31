import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

interface SlackUserData {
  slackUserId: string;
  github_token?: string;
  github_user?: {
    login: string;
    id: number;
    avatar_url: string;
    name?: string;
  };
  default_repository?: string;
  preferences?: {
    auto_suggestions: boolean;
    notification_channel?: string;
  };
  connected_at?: Date;
  last_activity?: Date;
}

export class SlackUserService {
  private db: any;

  constructor() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      // Check if Firebase is already initialized
      if (getApps().length === 0) {
        // Initialize Firebase with config from environment variables
        const firebaseConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
        };

        console.log('🔥 Initializing Firebase for SlackUserService:', {
          hasApiKey: !!firebaseConfig.apiKey,
          hasProjectId: !!firebaseConfig.projectId,
          projectId: firebaseConfig.projectId
        });

        initializeApp(firebaseConfig);
      }
      
      this.db = getFirestore();
      console.log('✅ Firebase initialized successfully for SlackUserService');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error);
      throw new Error(`Firebase initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store user GitHub authentication data
   */
  async storeGitHubAuth(slackUserId: string, githubData: {
    access_token: string;
    github_user: any;
  }): Promise<void> {
    try {
      const userRef = doc(this.db, 'slack_users', slackUserId);
      
      await setDoc(userRef, {
        slackUserId,
        github_token: githubData.access_token,
        github_user: {
          login: githubData.github_user.login,
          id: githubData.github_user.id,
          avatar_url: githubData.github_user.avatar_url,
          name: githubData.github_user.name,
        },
        connected_at: new Date(),
        last_activity: new Date(),
        preferences: {
          auto_suggestions: true, // Default to enabled
        }
      }, { merge: true });

      console.log('GitHub auth stored for Slack user:', slackUserId);
    } catch (error) {
      console.error('Error storing GitHub auth:', error);
      throw error;
    }
  }

  /**
   * Get user's GitHub token
   */
  async getGitHubToken(slackUserId: string): Promise<string | null> {
    try {
      if (!this.db) {
        console.warn('⚠️ Firebase not initialized, cannot get GitHub token');
        return null;
      }
      
      const userRef = doc(this.db, 'slack_users', slackUserId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as SlackUserData;
        return userData.github_token || null;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting GitHub token:', error);
      return null;
    }
  }

  /**
   * Check if user has GitHub authentication
   */
  async hasGitHubAuth(slackUserId: string): Promise<boolean> {
    try {
      if (!this.db) {
        console.warn('⚠️ Firebase not initialized, assuming no GitHub auth');
        return false;
      }
      const token = await this.getGitHubToken(slackUserId);
      return !!token;
    } catch (error) {
      console.error('Error checking GitHub auth:', error);
      return false;
    }
  }

  /**
   * Get user's complete data
   */
  async getUserData(slackUserId: string): Promise<SlackUserData | null> {
    try {
      const userRef = doc(this.db, 'slack_users', slackUserId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        return userDoc.data() as SlackUserData;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  /**
   * Update user's default repository
   */
  async setDefaultRepository(slackUserId: string, repository: string): Promise<void> {
    try {
      const userRef = doc(this.db, 'slack_users', slackUserId);
      
      await updateDoc(userRef, {
        default_repository: repository,
        last_activity: new Date(),
      });

      console.log('Default repository updated for user:', slackUserId, repository);
    } catch (error) {
      console.error('Error setting default repository:', error);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(slackUserId: string, preferences: Partial<SlackUserData['preferences']>): Promise<void> {
    try {
      const userRef = doc(this.db, 'slack_users', slackUserId);
      const currentData = await this.getUserData(slackUserId);
      
      const updatedPreferences = {
        ...currentData?.preferences,
        ...preferences,
      };
      
      await updateDoc(userRef, {
        preferences: updatedPreferences,
        last_activity: new Date(),
      });

      console.log('Preferences updated for user:', slackUserId);
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Record user activity
   */
  async recordActivity(slackUserId: string): Promise<void> {
    try {
      const userRef = doc(this.db, 'slack_users', slackUserId);
      
      await updateDoc(userRef, {
        last_activity: new Date(),
      });
    } catch (error) {
      // Don't throw on activity recording errors
      console.error('Error recording activity:', error);
    }
  }

  /**
   * Get user's GitHub repositories
   */
  async getUserRepositories(slackUserId: string): Promise<string[]> {
    try {
      if (!this.db) {
        console.warn('⚠️ Firebase not initialized, cannot get repositories');
        return [];
      }
      
      const token = await this.getGitHubToken(slackUserId);
      
      if (!token) {
        console.log('No GitHub token found for user:', slackUserId);
        return [];
      }

      // Fetch repositories from GitHub API
      const response = await fetch('https://api.github.com/user/repos?per_page=50&sort=updated&type=owner', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitPulse-Bot/1.0'
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch repositories from GitHub:', response.status, response.statusText);
        return [];
      }

      const repos = await response.json();
      const repoNames = repos
        .filter((repo: any) => !repo.fork && !repo.archived) // Only own, active repos
        .map((repo: any) => repo.full_name)
        .slice(0, 25); // Limit to 25 most recent

      console.log('Fetched repositories for user:', slackUserId, repoNames.length);
      return repoNames;
    } catch (error) {
      console.error('Error fetching user repositories:', error);
      return [];
    }
  }

  /**
   * Get users with auto-suggestions enabled for a channel
   */
  async getActiveUsersInChannel(channelId: string): Promise<SlackUserData[]> {
    // This would require more complex querying
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Fetch issues for a repository
   */
  async getIssuesForRepository(repoName: string): Promise<{ number: number; title: string }[]> {
    console.log('Fetching issues for repository:', repoName);
    // Mock implementation; replace with actual GitHub API call
    return [
      { number: 1, title: 'Sample Issue 1' },
      { number: 2, title: 'Sample Issue 2' },
    ];
  }

  /**
   * Fetch pull requests for a repository
   */
  async getPullRequestsForRepository(repoName: string): Promise<{ number: number; title: string; state: string }[]> {
    console.log('Fetching pull requests for repository:', repoName);
    // Mock implementation; replace with actual GitHub API call
    return [
      { number: 101, title: 'Sample PR 1', state: 'open' },
      { number: 102, title: 'Sample PR 2', state: 'closed' },
    ];
  }
}

// Export singleton instance
export const slackUserService = new SlackUserService();