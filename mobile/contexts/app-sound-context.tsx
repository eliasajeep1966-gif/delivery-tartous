import { useAudioPlayer } from "expo-audio";
import { createContext, useCallback, useContext, type PropsWithChildren } from "react";

const NEW_ORDER_SOUND = require("@/assets/sounds/new_order.mp3");
const CAPTAIN_ORDER_SUCCESS_SOUND = require("@/assets/sounds/captain-order-success.mp3");
const ADMIN_ORDER_SUCCESS_SOUND = require("@/assets/sounds/admin-order-success.mp3");

type AppSoundName =
  | "captainOrderSuccess"
  | "adminOrderSuccess";

type AppSoundContextValue = Readonly<{
  playSound: (name: AppSoundName) => void;
}>;

const AppSoundContext = createContext<AppSoundContextValue | null>(null);

export function AppSoundProvider({ children }: PropsWithChildren) {
  const captainOrderSuccess = useAudioPlayer(CAPTAIN_ORDER_SUCCESS_SOUND);
  const adminOrderSuccess = useAudioPlayer(ADMIN_ORDER_SUCCESS_SOUND);

  const playSound = useCallback(
    (name: AppSoundName) => {
      const player =
        name === "captainOrderSuccess"
          ? captainOrderSuccess
          : adminOrderSuccess;
      player.seekTo(0);
      player.play();
    },
    [adminOrderSuccess, captainOrderSuccess],
  );

  return (
    <AppSoundContext.Provider value={{ playSound }}>
      {children}
    </AppSoundContext.Provider>
  );
}

export function useAppSound() {
  const context = useContext(AppSoundContext);
  if (!context) {
    throw new Error("useAppSound must be used within AppSoundProvider");
  }
  return context;
}

export const bundledNotificationSound = NEW_ORDER_SOUND;
