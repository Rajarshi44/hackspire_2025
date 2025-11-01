DEVELOPER RESOURCES
AXICOV CLI
A comprehensive developer guide for the Axicov CLI tool - your complete solution for project deployment with configuration metadata and automated packaging.

Axicov CLI is a powerful command-line tool designed to streamline the deployment process for projects in Axicov. It automatically validates your langchain project configuration, processes environment variables, extracts README content, creates optimized zip archives, and deploys everything to your specified API endpoint.

What Axicov CLI Does
Configuration Validation: Ensures your project configuration is correct

Automated Deployment: Deploys metadata and project files to Axicov's store

Type Safety: Full TypeScript support with proper type definitions

Built for Performance
This CLI is optimized for Bun runtime but works seamlessly with Node.js, providing fast execution and native TypeScript support.

Getting Started
Prerequisites
Node.js 16.0.0 or higher (or Bun runtime)

npm, yarn, or bun package manager

A project with configuration files

Quick Start

Copy
# Install globally
npm install -g @axicov/cli

# Initialize a new project
axicov init my-project

# Deploy your project
axicov deploy -k "your-api-key"
Installation
Global Installation (Recommended, but look for version upgrades soon)

Copy
# Using npm
npm install -g @axicov/cli

# Using yarn  
yarn global add @axicov/cli

# Using bun
bun install -g @axicov/cli
Local Installation

Copy
# Using npm
npm install @axicov/cli --save-dev

# Using yarn
yarn add @axicov/cli --dev

# Using bun
bun add @axicov/cli --dev
Verify Installation

Copy
axicov --version
# Output: 1.0.2
Project Structure
A typical Axicov-enabled project structure looks like this:


Copy
my-project/
├── axicov.config.ts        # Configuration file (required)
├── README.md               # Project documentation
├── .env                    # Environment variables
├── .gitignore             # Git ignore patterns
├── package.json           # Node.js dependencies
├── src/                   # Source code
│   ├── index.ts
│   └── utils/
├── dist/                  # Build output (auto-created)
│   └── project.zip        # Generated zip file
└── node_modules/          # Dependencies (ignored)
Key Files
File
Purpose
Required
axicov.config.ts

Main configuration file

✅ Yes

README.md

Project documentation

✅ Yes

.env

Environment variables

✅ Yes

.gitignore

Files to exclude from uploading

Recommended

Configuration
Configuration File
Axicov requires an axicov.config.ts (or axicov.config.js) file in your project root. This file defines your project metadata and deployment settings.

Basic Configuration


Copy
// axicov.config.ts
const axicovConfig = {
  name: "my-axicov-project",
  description: "A modern TypeScript application with best practices",
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
  tags: ["TypeScript", "Node.js", "Web Application"]
};

export default axicovConfig;
LangChain TypeScript Configuration


Copy
// axicov.config.ts for LangChain projects
const axicovConfig = {
  name: "langchain-ai-app",
  description: "A LangChain TypeScript application for building AI-powered solutions",
  readmePath: "./README.md",
  env: "./.env",
  
  params: {
    prompt: {
      type: String,
      description: "The prompt that the LLM will respond to",
      required: false
    },
    temperature: {
      type: Number,
      description: "LLM temperature setting (0.0 to 1.0)",
      required: false
    },
    maxTokens: {
      type: Number,
      description: "Maximum tokens for LLM responses",
      required: false
    }
  },
  
  port: 3000,
  tags: ["LangChain", "TypeScript", "AI", "LLM", "Vector Store"]
};

export default axicovConfig;
Configuration Fields
Field
Type
Required
Description
name

string

Yes

Project name (must be non-empty)

description

string

Yes

Project description

readmePath

string

Yes

Path to README file (relative or absolute)

env

string

Yes

Path to environment file

params

object

Yes

Custom parameters with type definitions

port

number

Yes

Application port (1-65535)

tags

string[]

No

Optional array of project tags

Parameter Definitions
Each parameter in the params object must follow this structure:


Copy
{
  type: String | Number,        // Constructor function
  description: string,          // Human-readable description
  required: boolean            // Whether the parameter is required
}
Environment Variables
Create a .env file in your project root:


Copy
# .env
NODE_ENV=production
API_URL=https://api.example.com
DATABASE_URL=postgresql://localhost:5432/mydb
SECRET_KEY=your-secret-key-here

# LangChain specific (if applicable)
OPENAI_API_KEY=sk-...
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls__...
Troubleshooting
Common Issues and Solutions
1. Configuration File Not Found

Error:


Copy
Configuration file not found. Looking for: axicov.config.ts or axicov.config.js in /path/to/project
Solutions:

Run axicov init to create the configuration file

Ensure you're in the correct project directory

Check file naming: must be exactly axicov.config.ts or axicov.config.js

2. Invalid Configuration Structure

Error:


Copy
Configuration validation failed
   • 'params' must be an object, got array
   • params.version.type must be String or Number constructor
Solutions:

Verify parameter definitions follow the correct structure:


Copy
params: {  fieldName: {    type: String,           // Must be String or Number constructor    description: string,    // Must be a string    required: boolean      // Must be true or false  }}
Check that all required fields are present and have correct types

3. Environment File Issues

Error:


Copy
Environment file not found: /path/to/.env
Solutions:

Create the .env file: touch .env

Check the path in your config file matches the actual file location

Ensure proper file permissions (readable)

Environment parsing errors:


Copy
Warning: Invalid env line 5 in .env: "INVALID_LINE_WITHOUT_EQUALS"
Solutions:

Each line should follow format: KEY=value

Use # for comments

Quote values with spaces: KEY="value with spaces"

4. Port Configuration Issues

Error:


Copy
'port' must be between 1 and 65535, got 70000
Solutions:

Choose a port in valid range: 1-65535

Recommended: Use ports > 1024 to avoid system port conflicts

Common choices: 3000, 8080, 8000, 5000

5. API Deployment Failures

Error:


Copy
API request failed: 401 Unauthorized
Response: {"error": "Invalid API key"}
Solutions:

Verify your API key is correct and active

Check if the API key has proper permissions

Ensure you're using the correct API endpoint

Error:


Copy
Failed to deploy: fetch failed
Solutions:

Check internet connectivity

Verify the API endpoint is accessible

Ensure no firewall blocking outbound requests

6. File Permission Issues

Error:


Copy
Output directory is not writable: /path/to/dist
Solutions:

Create the directory: mkdir -p dist

Fix permissions: chmod 755 dist

Use a different output path: -o "./build"

7. Large Project Zipping Issues

Error:


Copy
Archive size: 150.2 MB
Warning: Large archive may cause deployment issues
Solutions:

Review your .gitignore to exclude unnecessary files:


Copy
node_modules/dist/*.log.DS_Storecoverage/
Remove large files that aren't needed for deployment

Consider using compression level 9: modify source code or use custom build

8. Configuration validation error
You can get a message like this:


Copy
Configuration validation failed
   • Failed to load configuration: Error loading config file: Failed to load config file. ES module error: Unexpected token 'export'. CommonJS error: Unexpected token 'export'
✖ Deployment failed
to fix this, change this line in axicov.config.ts 

Copy
export default axicovConfig
to,


Copy
module.exports = axicovConfig;
Debug Mode
Enable verbose output for detailed troubleshooting:


Copy
axicov deploy -k "your-key" -v
This shows:

Full configuration details

Complete metadata JSON

File scanning progress

API request/response details

Getting Help
If you encounter issues not covered here:

Check the documentation in your project's README

Verify all requirements are met (Node.js version, file structure)

Test with a minimal project to isolate the issue

Check API endpoint status if deployment fails

Best Practices
1. Project Organization
Recommended Structure:


Copy
your-project/
├── axicov.config.ts          # Keep config in TypeScript
├── README.md                 # Comprehensive documentation
├── .env                      # Production environment
├── .env.example              # Template for other developers
├── .gitignore               # Properly configured
├── src/                     # Source code
├── tests/                   # Test files
└── docs/                    # Additional documentation
2. Configuration Management
Type-Safe Configurations:


Copy
// Use TypeScript for better IDE support and validation
const axicovConfig = {
  // Use descriptive names
  name: "user-authentication-service",
  
  // Write clear descriptions
  description: "Handles user registration, login, and JWT token management",
  
  // Use consistent paths
  readmePath: "./README.md",
  env: "./.env",
  
  // Document parameters thoroughly
  params: {
    jwtSecret: {
      type: String,
      description: "Secret key for JWT token signing and verification",
      required: true
    },
    tokenExpiry: {
      type: String,
      description: "JWT token expiration time (e.g., '7d', '24h')",
      required: false
    }
  }
};
3. Environment Variables
Security Best Practices:


Copy
# .env - Production values
NODE_ENV=production
JWT_SECRET=your-super-secret-production-key
DATABASE_URL=postgresql://user:password@prod-db:5432/app

# Don't commit sensitive values!
# Use .env.example for templates

Copy
# .env.example - Template for developers
NODE_ENV=development
JWT_SECRET=development-secret-change-in-production
DATABASE_URL=postgresql://localhost:5432/app_dev
Organization:


Copy
# Group related variables
# === Database Configuration ===
DATABASE_URL=postgresql://localhost:5432/myapp
DATABASE_POOL_SIZE=10
DATABASE_TIMEOUT=30000

# === Authentication ===
JWT_SECRET=your-jwt-secret
JWT_EXPIRY=7d
BCRYPT_ROUNDS=12

# === External APIs ===
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_...
SENDGRID_API_KEY=SG...
4. README Documentation
Structure your README.md:


Copy
# Project Name

Brief description of what your project does.

## Features

- Feature 1
- Feature 2

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `PORT` | Server port | No | `3000` |

## Deployment

This project uses Axicov CLI for deployment:

```bash
axicov deploy -k "your-api-key"
This guide covers the essential functionality of Axicov CLI. For advanced use cases and API integration details, refer to the official documentation or source code.