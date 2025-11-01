import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Bot, MessageSquare, Zap, Settings, ExternalLink } from "lucide-react";
import { useState } from "react";

interface SlackIntegrationProps {
  isConnected?: boolean;
  workspaceName?: string;
  botUserId?: string;
}

export function SlackIntegration({ 
  isConnected = false, 
  workspaceName = "Your Workspace",
  botUserId = "@gitpulse"
}: SlackIntegrationProps) {
  const [autoDetection, setAutoDetection] = useState(true);
  const [channelMonitoring, setChannelMonitoring] = useState(false);

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bot className="h-8 w-8 text-purple-600" />
              <div>
                <CardTitle>Slack Integration</CardTitle>
                <CardDescription>
                  Connect GitPulse to your Slack workspace for seamless issue tracking
                </CardDescription>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connected" : "Not Connected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-green-900/20 border-green-700/40">
                <div>
                  <p className="font-medium text-green-300">Connected to {workspaceName}</p>
                  <p className="text-sm text-green-400">Bot user: {botUserId}</p>
                </div>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="font-medium">Slash Commands</p>
                  <p className="text-sm text-muted-foreground">Use /gitpulse in Slack</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                  <p className="font-medium">Auto-Detection</p>
                  <p className="text-sm text-muted-foreground">AI analyzes messages</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Bot className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <p className="font-medium">Bot Mentions</p>
                  <p className="text-sm text-muted-foreground">@gitpulse for help</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Slack Not Connected</h3>
              <p className="text-muted-foreground mb-4">
                Connect your Slack workspace to start using GitPulse in your channels
              </p>
              <Button>
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect Slack Workspace
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Customize how GitPulse works in your Slack workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Auto-detection Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-detection">Automatic Issue Detection</Label>
                  <p className="text-sm text-muted-foreground">
                    AI automatically analyzes messages and suggests creating GitHub issues
                  </p>
                </div>
                <Switch
                  id="auto-detection"
                  checked={autoDetection}
                  onCheckedChange={setAutoDetection}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="channel-monitoring">Proactive Suggestions</Label>
                  <p className="text-sm text-muted-foreground">
                    Get smart suggestions with one-click GitHub integration
                  </p>
                </div>
                <Switch
                  id="channel-monitoring"
                  checked={channelMonitoring}
                  onCheckedChange={setChannelMonitoring}
                />
              </div>

              <div className="p-4 rounded-lg border bg-primary/10 border-primary/20">
                <h4 className="font-medium text-primary mb-2">🚀 New: Smart Auto-Detection</h4>
                <ul className="text-sm text-primary/90 space-y-1">
                  <li>• AI listens to conversations and detects potential issues</li>
                  <li>• One-click GitHub authentication when needed</li>
                  <li>• Automatic repository selection from your GitHub account</li>
                  <li>• Smart suggestions with pre-filled issue details</li>
                </ul>
              </div>
            </div>

            <Separator />

            {/* Default Repository */}
            <div className="space-y-2">
              <Label htmlFor="default-repo">Default GitHub Repository</Label>
              <Input
                id="default-repo"
                placeholder="owner/repository-name"
                defaultValue=""
              />
              <p className="text-sm text-muted-foreground">
                Default repository for creating issues when not specified
              </p>
            </div>

            {/* AI Prompt Customization */}
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">Custom AI Instructions</Label>
              <Textarea
                id="ai-prompt"
                placeholder="Additional instructions for the AI when analyzing messages..."
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                Customize how the AI analyzes your team's messages
              </p>
            </div>

            <div className="flex justify-end">
              <Button>Save Configuration</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Guide */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use GitPulse in Slack</CardTitle>
          <CardDescription>
            Quick guide to get started with GitPulse commands and features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Badge variant="outline" className="mt-1">1</Badge>
              <div>
                <p className="font-medium">Connect GitHub (One-time)</p>
                <p className="text-sm text-gray-600">
                  Click "Connect GitHub" when prompted to link your account for automatic issue creation
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Badge variant="outline" className="mt-1">2</Badge>
              <div>
                <p className="font-medium">Chat Naturally</p>
                <p className="text-sm text-gray-600">
                  Just discuss bugs, features, or problems normally - AI automatically detects potential issues
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Badge variant="outline" className="mt-1">3</Badge>
              <div>
                <p className="font-medium">One-Click Issue Creation</p>
                <p className="text-sm text-gray-600">
                  When AI detects an issue, click "Create GitHub Issue" - details are pre-filled automatically
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Badge variant="outline" className="mt-1">4</Badge>
              <div>
                <p className="font-medium">Manual Commands</p>
                <p className="text-sm text-muted-foreground">
                  Use <code className="bg-muted px-1 rounded">/gitpulse analyze</code> or 
                  <code className="bg-muted px-1 rounded ml-1">/gitpulse create-issue</code> for manual control
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="p-4 rounded-lg border bg-primary/10 border-primary/20">
            <h4 className="font-medium text-primary mb-2">💡 Pro Tips</h4>
            <ul className="text-sm text-primary/90 space-y-1">
              <li>• Add GitPulse to channels where development discussions happen</li>
              <li>• Use @mentions in your messages to auto-assign GitHub issues</li>
              <li>• The AI learns from your team's communication patterns</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}