module.exports = {
  name: "hackspire-coding-agent-6teens",
  description: "A coding agent for the Hackspire 2025 project, built with TypeScript and optimized for Axicov deployment.",
  readmePath: "./README.md",
  env: "./.env",
  params: {
    version: {
      type: String,
      description: "Project version",
      required: true
    },
    author: {
      type: String,
      description: "Project author",
      required: false
    },
    license: {
      type: String,
      description: "Project license",
      required: false
    }
  },
  port: 3000,
  tags: ["TypeScript", "Node.js", "AI", "Coding Agent"]
};