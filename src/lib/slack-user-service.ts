import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

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
    this.db = getFirestore();
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
   * Get users with auto-suggestions enabled for a channel
   */
  async getActiveUsersInChannel(channelId: string): Promise<SlackUserData[]> {
    // This would require more complex querying
    // For now, return empty array as placeholder
    return [];
  }
}

// Export singleton instance
export const slackUserService = new SlackUserService();