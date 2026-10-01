import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// 접근성 "동작 줄이기" 설정 구독 — 애니메이션(스캔 라인·흐르는 바) on/off 판정에 공용.
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    // jest-expo 등에선 undefined를 반환할 수 있어 Promise.resolve로 감싼다.
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .then((v) => {
        if (mounted && typeof v === "boolean") setReduce(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) =>
      setReduce(v),
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}
