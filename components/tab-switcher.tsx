"use client";

import { Lock, LockOpen } from "@phosphor-icons/react";
import { useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type TabValue = "decrypt" | "encrypt";

interface TabSwitcherProps {
  children: (activeTab: TabValue) => React.ReactNode;
  defaultTab?: TabValue;
}

function TabSwitcher({ defaultTab = "encrypt", children }: TabSwitcherProps) {
  const [activeTab, setActiveTab] = useState<TabValue>(defaultTab);

  return (
    <div className="space-y-6">
      <Tabs
        className="w-full"
        onValueChange={(value) => setActiveTab(value as TabValue)}
        value={activeTab}
      >
        <TabsList className="grid h-12 w-full grid-cols-2 rounded-2xl border border-border/70 bg-card/70 p-1.5">
          <TabsTrigger className="gap-2 rounded-xl" value="encrypt">
            <Lock
              className={cn(
                "size-4",
                activeTab === "encrypt" ? "text-primary" : "text-current"
              )}
              weight={activeTab === "encrypt" ? "duotone" : "regular"}
            />
            Share
          </TabsTrigger>
          <TabsTrigger className="gap-2 rounded-xl" value="decrypt">
            <LockOpen
              className={cn(
                "size-4",
                activeTab === "decrypt" ? "text-primary" : "text-current"
              )}
              weight={activeTab === "decrypt" ? "duotone" : "regular"}
            />
            Retrieve
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-center">
        <p className="text-muted-foreground text-xs leading-5">
          {activeTab === "encrypt"
            ? "Create a sealed envelope and send the link with a separate passphrase."
            : "Retrieve an envelope and decrypt it locally without exposing secrets to the server."}
        </p>
      </div>

      {children(activeTab)}
    </div>
  );
}

export type { TabValue };
export { TabSwitcher };
