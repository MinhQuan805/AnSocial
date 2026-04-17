"use client";

import { CircleAlert } from "lucide-react";
import { type ComponentProps } from "react";

import { InstagramBuilderCard } from "@/components/app/console/cards/builder/instagram-builder-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface InstagramBuilderSectionProps {
  hasOAuthConnection: boolean;
  isInstagramOAuthLinked: boolean;
  builderCardProps: ComponentProps<typeof InstagramBuilderCard>;
}

export function InstagramBuilderSection({
  hasOAuthConnection,
  isInstagramOAuthLinked,
  builderCardProps,
}: InstagramBuilderSectionProps) {
  if (!hasOAuthConnection) {
    return (
      <Alert className="border-amber-300/80 bg-amber-50 text-amber-900">
        <CircleAlert className="h-4 w-4" />
        <AlertTitle>Instagram OAuth is required</AlertTitle>
        <AlertDescription>
          Connect your Instagram account first. Builder and HTTP Request linking only work after OAuth is connected.
        </AlertDescription>
      </Alert>
    );
  }

  if (!isInstagramOAuthLinked) {
    return (
      <Alert className="border-amber-300/80 bg-amber-50 text-amber-900">
        <CircleAlert className="h-4 w-4" />
        <AlertTitle>Switch authorization to OAuth</AlertTitle>
        <AlertDescription>
          Instagram Builder is currently detached from HTTP Request. Change Authorization mode to OAuth to link them.
        </AlertDescription>
      </Alert>
    );
  }

  return <InstagramBuilderCard {...builderCardProps} />;
}
