"use client";

import { DecryptForm } from "@/components/decrypt-form";
import { EncryptForm } from "@/components/encrypt-form";
import { TabSwitcher } from "@/components/tab-switcher";

function MainShell() {
  return (
    <TabSwitcher>
      {(activeTab) => (
        <div className="animate-vault-fade-in pt-1">
          {activeTab === "encrypt" ? <EncryptForm /> : <DecryptForm />}
        </div>
      )}
    </TabSwitcher>
  );
}

export { MainShell };
