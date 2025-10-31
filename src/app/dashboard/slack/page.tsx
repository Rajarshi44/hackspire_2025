'use client';

import { SlackIntegration } from '@/components/slack-integration';

export default function SlackSettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Slack Integration</h1>
        <p className="text-muted-foreground mt-2">
          Connect GitPulse to your Slack workspace for seamless development collaboration
        </p>
      </div>
      
      <SlackIntegration 
        isConnected={true} // This would come from your app's state
        workspaceName="Development Team"
        botUserId="@gitpulse"
      />
    </div>
  );
}