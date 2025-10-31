# Mention System Implementation

## Overview

The mention system allows users to tag collaborators using `@username` when writing messages. When an issue is detected from the message, mentioned users will be automatically assigned to the GitHub issue.

## Features

1. **Auto-complete mentions**: Type `@` to see a list of repository collaborators
2. **Visual highlighting**: Mentioned users appear highlighted in chat messages  
3. **Automatic assignment**: When AI detects an issue, mentioned users are assigned to the GitHub issue
4. **Collaborator integration**: Fetches both GitHub collaborators and invited users

## Usage Examples

### Basic Issue Creation with Mentions
```
/issue Fix the login button @john @sarah

The login button is not working properly on mobile devices.
```

### Natural Issue Detection with Mentions
```
Hey @mike, I noticed the search functionality is broken again. 
Can you take a look? Also @lisa might want to help with the UI part.
```

### Auto-complete Flow
1. Type `@` in the message input
2. A dropdown appears with available collaborators
3. Use arrow keys to navigate or click to select
4. Continue typing to filter the list
5. Press Enter/Tab to insert the mention

## Technical Implementation

### Components Added/Modified

1. **`MentionInput`** - New component handling @ mentions with autocomplete
2. **`useCollaborators`** - Hook to fetch repository collaborators
3. **`MessageInput`** - Updated to use MentionInput instead of Textarea
4. **`ChatInterface`** - Updated to handle mentions in message flow
5. **`ChatMessage`** - Updated to visually highlight mentions

### AI Flow Updates

1. **Issue Detection** - Now accepts mentions in input schema
2. **Issue Creation** - Now supports assignees parameter
3. **GitHub API** - Properly formats assignees for GitHub issues

### Data Schema

Messages now include:
```typescript
type Message = {
  // ... existing fields
  mentions?: string[]; // Array of mentioned usernames
  issueDetails?: {
    // ... existing fields
    assignees?: string[]; // Users to assign to the issue
  };
}
```

## GitHub API Integration

When creating issues, the system will:
1. Extract usernames from mentions (`@john` → `john`)
2. Pass them as assignees to the GitHub Issues API
3. GitHub will automatically assign these users to the created issue

Note: Users must be collaborators on the repository to be assigned to issues.