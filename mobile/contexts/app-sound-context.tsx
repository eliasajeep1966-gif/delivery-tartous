import { useAudioPlayer } from "expo-audio";
import { createContext, useCallback, useContext, type PropsWithChildren } from "react";

const NEW_ORDER_SOUND = require("@/assets/sounds/new_order.mp3");
const ORDER_CANCELLED_SOUND = require("@/assets/sounds/order_cancelled.mp3");
const CAPTAIN_ORDER_SUCCESS_SOUND = require("@/assets/sounds/captain_order_success.mp3");
const ADMIN_ORDER_SUCCESS_SOUND = require("@/assets/sounds/admin_order_success.mp3");

type AppSoundName =
  | "newOrder"
  | "orderCancelled"
  | "captainOrderSuccess"
  | "adminOrderSuccess";

type AppSoundContextValue = Readonly<{
  playSound: (name: AppSoundName) => void;
}>;

const AppSoundContext = createContext<AppSoundContextValue | null>(null);

export function AppSoundProvider({ children }: PropsWithChildren) {
  const newOrder = useAudioPlayer(NEW_ORDER_SOUND);
  const orderCancelled = useAudioPlayer(ORDER_CANCELLED_SOUND);
  const captainOrderSuccess = useAudioPlayer(CAPTAIN_ORDER_SUCCESS_SOUND);
  const adminOrderSuccess = useAudioPlayer(ADMIN_ORDER_SUCCESS_SOUND);

  const playSound = useCallback(
    (name: AppSoundName) => {
      const player =
        name === "newOrder"
          ? newOrder
          : name === "orderCancelled"
            ? orderCancelled
            : name === "captainOrderSuccess"
              ? captainOrderSuccess
              : adminOrderSuccess;
      player.seekTo(0);
      player.play();
    },
    [adminOrderSuccess, captainOrderSuccess, newOrder, orderCancelled],
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
