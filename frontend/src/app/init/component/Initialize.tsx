// frontend/src/component/InitializeContract.tsx
"use client";
import "@mysten/dapp-kit/dist/index.css";
import { ConnectButton, useSuiClient } from "@mysten/dapp-kit";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { useState, useEffect, useRef } from "react";
import useHeirStore from "../../../store/heirStore";
import { useRouter } from "next/navigation";
import useMoveStore from "../../../store/moveStore";
import { bcs, BcsType } from "@mysten/bcs";
import HeirCard from "./HeirCard";
import Image from "next/image";
import "./InitializeContract.css"; // Import CSS styles

// Type definitions
interface Heir {
  id: string;
  name: string;
  address: string;
  ratio: string;
}

interface SeparatedHeirs {
  suiAddressHeirs: Heir[];
  emailHeirs: Heir[];
}

interface VecMapData {
  keys: string[];
  values: string[];
}
// VecMap function for serializing key-value pairs (remains unchanged)
function VecMap<K extends BcsType<any>, V extends BcsType<any>>(K: K, V: V) {
  return bcs.struct(`VecMap<${K.name}, ${V.name}>`, {
    keys: bcs.vector(K),
    values: bcs.vector(V),
  });
}
// Other helper functions remain unchanged
function separateHeirsByAddressType(heirs: Heir[]): SeparatedHeirs {
  const suiAddressHeirs: Heir[] = [];
  const emailHeirs: Heir[] = [];

  heirs.forEach((heir) => {
    if (
      heir.address &&
      heir.address.startsWith("0x") &&
      !heir.address.includes("@")
    ) {
      suiAddressHeirs.push({ ...heir });
    } else {
      emailHeirs.push({ ...heir });
    }
  });

  return {
    suiAddressHeirs,
    emailHeirs,
  };
}

function prepareHeirsForVecMap(heirs: Heir[], keyField: keyof Heir, valueField: keyof Heir): VecMapData {
  return {
    keys: heirs.map((heir) => heir[keyField] as string),
    values: heirs.map((heir) => heir[valueField] as string),
  };
}

function serializeHeirsToVecMaps(heirs: Heir[]) {
  // Separate heirs
  const { suiAddressHeirs, emailHeirs } = separateHeirsByAddressType(heirs);

  // Prepare VecMap data for Sui address heirs
  const suiNameRatioMap = {
    keys: suiAddressHeirs.map((heir) => heir.name),
    values: suiAddressHeirs.map((heir) => heir.ratio),
  };

  const suiAddressRatioMap = {
    keys: suiAddressHeirs.map((heir) => heir.address),
    values: suiAddressHeirs.map((heir) => heir.ratio),
  };

  // Prepare VecMap data for email heirs
  const emailNameRatioMap = {
    keys: emailHeirs.map((heir) => heir.name),
    values: emailHeirs.map((heir) => heir.ratio),
  };

  const emailAddressRatioMap = {
    keys: emailHeirs.map((heir) => heir.address),
    values: emailHeirs.map((heir) => heir.ratio),
  };

  // Create raw data version for debugging (not serialized)
  const rawData = {
    suiNameRatio: suiNameRatioMap,
    suiAddressRatio: suiAddressRatioMap,
    emailNameRatio: emailNameRatioMap,
    emailAddressRatio: emailAddressRatioMap,
  };

  // Serialize data
  const serializedData = {
    suiNameRatio: VecMap(bcs.string(), bcs.string())
      .serialize(suiNameRatioMap)
      .toBytes(),

    suiAddressRatio: VecMap(bcs.string(), bcs.string())
      .serialize(suiAddressRatioMap)
      .toBytes(),

    emailNameRatio: VecMap(bcs.string(), bcs.string())
      .serialize(emailNameRatioMap)
      .toBytes(),

    emailAddressRatio: VecMap(bcs.string(), bcs.string())
      .serialize(emailAddressRatioMap)
      .toBytes(),
  };

  return {
    raw: rawData,
    serialized: serializedData,
  };
}

export default function InitializeContract() {
  const account = useCurrentAccount();
  const router = useRouter();
  const client = useSuiClient();
  const setAddress = useMoveStore((s) => s.setAddress);
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showObjectChanges: true,
        },
      }),
  });
  // Store previous heirs count and animation state refs
  const prevHeirsCountRef = useRef<number>(0);
  const animationInProgressRef = useRef<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);
  // State management
  const [vaultID, setVaultID] = useState("");
  const [ownerCap, setOwnerCap] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [wavesPosition, setWavesPosition] = useState(0);
  const [showRedirectButton, setShowRedirectButton] = useState(false);

  // Get states and methods from Zustand store
  const {
    isConnecting,
    showWelcome,
    showNextCard,
    showWarning,
    warningMessage,
    heirs,
    setIsConnecting,
    setShowWelcome,
    setShowNextCard,
    closeWarning,
    addHeir,
    removeHeir,
    updateHeir,
    getTotalRatio,
    handleVerify,
    showWarningMessage,
  } = useHeirStore();

  const { createVaultTx } = useMoveStore();

  // ... existing code ...
  const handleConnect = async () => {
    try {
      console.log("Connect button clicked - handleConnect function");
      console.log("Current connection state:", isConnecting);

      // The ConnectButton component from @mysten/dapp-kit will handle the actual connection
      // We just need to wait for the account to be available
      if (!account) {
        console.log("Waiting for wallet connection...");
        return;
      }

      // Once we have an account, update our state
      if (account.address) {
        console.log("Wallet connected with address:", account.address);
        setIsConnecting(true);
        setAddress(account.address); // Update the address in moveStore
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      showWarningMessage("Failed to connect wallet: " + error.message);
    }
  };
  // Monitor account changes
  useEffect(() => {
    if (account?.address) {
      console.log("Account updated:", account.address);
      setAddress(account.address);

      // If we have an account but not connected, update connection state
      if (!isConnecting) {
        setIsConnecting(true);
      }
    }
  }, [account, isConnecting, setAddress, setIsConnecting]);

  useEffect(() => {
    if (account) {
      setAddress(account.address);
    }
  }, [account, setAddress]);
  // Handle manual proceed to next step
  const handleProceed = () => {
    if (account && account.address) {
      setShowNextCard(true);
    }
  };

  // Wave background animation
  useEffect(() => {
    const waveAnimation = setInterval(() => {
      setWavesPosition((prev) => (prev + 1) % 100);
    }, 50);

    return () => clearInterval(waveAnimation);
  }, []);

  // Monitor changes in heirs count, control card animation
  useEffect(() => {
    if (
      heirs.length !== prevHeirsCountRef.current &&
      !animationInProgressRef.current
    ) {
      animationInProgressRef.current = true;

      requestAnimationFrame(() => {
        if (heirs.length > prevHeirsCountRef.current) {
          if (cardRef.current) {
            // Card expansion animation
            cardRef.current.style.transition =
              "max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
            cardRef.current.style.maxHeight = `${
              cardRef.current.scrollHeight + 80
            }px`;

            // Find newly added heir fields
            const newHeirElements = document.querySelectorAll("[data-heir-id]");
            const newHeirElement = newHeirElements[
              newHeirElements.length - 1
            ] as HTMLElement;

            if (newHeirElement) {
              // Set initial animation state
              newHeirElement.style.opacity = "0";
              newHeirElement.style.transform = "translateY(15px)";

              // Force browser repaint
              void newHeirElement.offsetWidth;

              // Start element animation
              setTimeout(() => {
                newHeirElement.style.transition =
                  "opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
                newHeirElement.style.opacity = "1";
                newHeirElement.style.transform = "translateY(0)";
              }, 50);
            }

            setTimeout(() => {
              animationInProgressRef.current = false;
            }, 500);
          }
        } else {
          // Shrink animation when removing heirs
          if (cardRef.current) {
            cardRef.current.style.transition =
              "max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
            cardRef.current.style.maxHeight = `${cardRef.current.scrollHeight}px`;

            setTimeout(() => {
              animationInProgressRef.current = false;
            }, 500);
          } else {
            animationInProgressRef.current = false;
          }
        }

        // Update heirs count
        prevHeirsCountRef.current = heirs.length;
      });
    }
  }, [heirs.length]);

  // Handle adding heir
  const handleAddHeir = () => {
    if (animationInProgressRef.current) return;
    addHeir();
  };
  // Format address display
  const formatAddress = (address: string | undefined): string => {
    if (!address) return " ";
    return `${address.slice(0, 5)}...${address.slice(-5)}`;
  };

  // Create and execute the first transaction
  const executeTransaction = async () => {
    // Form validation
    if (handleVerify()) {
      try {
        setIsProcessing(true);

        // Output data to console
        const { raw } = serializeHeirsToVecMaps(heirs);
        console.log("=== VecMap data at transaction execution ===");
        console.log("Sui heirs:");
        console.table(raw.suiNameRatio);
        console.table(raw.suiAddressRatio);
        console.log("Email heirs:");
        console.table(raw.emailNameRatio);
        console.table(raw.emailAddressRatio);

        // Execute transaction
        const transactionResult = await signAndExecuteTransaction(
          {
            transaction: createVaultTx(),
            chain: "sui:testnet",
          },
          {
            onSuccess: (result: any) => {
              console.log("executed transaction", result);
              // Extract vaultID and ownerCap from transaction result
              const vaultObject = result.objectChanges.find(
                (obj) =>
                  obj.type === "created" &&
                  obj.objectType.includes("::seaVault::SeaVault")
              );
              const ownerCapObject = result.objectChanges.find(
                (obj) =>
                  obj.type === "created" &&
                  obj.objectType.includes("::seaVault::OwnerCap")
              );

              if (vaultObject && ownerCapObject) {
                // Type assertion to access the objectId property
                const vaultIDFromTx = (vaultObject as any).objectId;
                const ownerCapFromTx = (ownerCapObject as any).objectId;

                console.log("Vault ID:", vaultIDFromTx);
                console.log("Owner Cap:", ownerCapFromTx);

                // Save values for later use
                setVaultID(vaultIDFromTx);
                setOwnerCap(ownerCapFromTx);

                // Store vaultID and ownerCap in localStorage for use on other pages
                localStorage.setItem("vaultID", vaultIDFromTx);
                localStorage.setItem("ownerCap", ownerCapFromTx); // Display success message and redirect button
                showSuccessMessage();
                setShowRedirectButton(true);
                setShowNextCard(false);
              } else {
                console.error(
                  "Failed to retrieve Vault ID or Owner Cap from the result."
                );
                showWarningMessage(
                  "Unable to retrieve vault information from transaction result."
                );
              }

              setIsProcessing(false);
            },
            onError: (error) => {
              console.error("Transaction error:", error);
              showWarningMessage("Transaction failed: " + error.message);
              setIsProcessing(false);
            },
          }
        );

        return transactionResult;
      } catch (error) {
        console.error("Transaction execution error:", error);
        showWarningMessage("Transaction execution error: " + error.message);
        setIsProcessing(false);
      }
    }
  };
  // Display success message
  const showSuccessMessage = () => {
    // You can add any success message logic here if needed
  };

  // Handle redirect to dashboard
  const handleRedirectToDashboard = () => {
    router.push("/dashboard/settings");
  };

  const CustomConnectButton = () => (
    <div className='connect-button'>
      <ConnectButton />
    </div>
  );

  return (
    <div className='container'>
      {/* Ocean background elements */}
      <div className='ocean-background'>
        <div className='bubble bubble1'></div>
        <div className='bubble bubble2'></div>
        <div className='bubble bubble3'></div>
        <div className='waves'>
          <div className='wave1'></div>
          <div className='wave2'></div>
        </div>
      </div>
      {/* Main title */}
      <div className='header'>
        <h1 className='title'>
          <Image
            src='/RMBGlogo.png'
            width={36}
            height={36}
            alt='Anchor'
            className='title-logo'
          />
          <span className='title-text'>SeaVault</span>
        </h1>
        <p className='subtitle'>
          Protect your digital assets, guard your journey
        </p>
      </div>{" "}
      {/* Connect card */}
      <div
        className={`connect-card ${
          showNextCard || showRedirectButton ? "hidden" : ""
        }`}
      >
        <h1>Establish Your Digital Legacy</h1>
        <p>
          Connect your wallet to start planning your digital asset inheritance
        </p>

        <div className='space-y-4'>
          {/* Always show ConnectButton for wallet connection/switching */}
          <div className='connect-button' onClick={handleConnect}>
            <ConnectButton />
          </div>

          {/* Show status and proceed button when wallet is connected */}

          <div className='justify-between items-center flex flex-row-reverse'>
            <button
              className='px-6 py-3 bg-transparent hover:bg-white/15 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              onClick={handleProceed}
              disabled={!account?.address || isProcessing}
            >
              Proceed to Setup
            </button>
          </div>
        </div>
      </div>
      {/* Set heirs card */}
      {showNextCard && (
        <div className='heir-card'>
          <div className='container'>
            <div className='icon'></div>
            <HeirCard
              heirs={heirs}
              addHeir={addHeir}
              removeHeir={removeHeir}
              updateHeir={updateHeir}
              getTotalRatio={getTotalRatio}
              handleVerify={executeTransaction}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      )}
      {/* Success card with redirect button */}
      {showRedirectButton && (
        <div className='connect-card'>
          <h1>Vault Created Successfully!</h1>
          <p>
            Your SeaVault has been created and configured. You can now proceed
            to the dashboard to manage your digital assets.
          </p>
          <div className='space-y-2 mb-6'>
            <p className='text-sm text-slate-300'>
              Vault ID: {formatAddress(vaultID)}
            </p>
            <p className='text-sm text-slate-300'>
              Owner Cap: {formatAddress(ownerCap)}
            </p>
          </div>
          <div className='flex justify-center'>
            <button
              onClick={handleRedirectToDashboard}
              className='px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:scale-105'
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
      {/* Warning dialog */}
      {showWarning && (
        <div
          className='fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm'
          onClick={closeWarning}
        >
          <div className='bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden transform transition-all'>
            <div className='px-6 py-4'>
              <p className='text-l text-gray-700 dark:text-gray-300'>
                {warningMessage}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
