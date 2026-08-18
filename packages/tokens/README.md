# @clause-lens/tokens

ClauseLens 디자인 토큰. **3층 구조**로, 컴포넌트는 primitive 를 직접 쓰지 않고 semantic 을 쓴다.

```
primitives.js   1층 원시 팔레트 (cobalt, neutral, red, amber, green)  ← 직접 사용 금지
   ↓
semantic.js     2층 역할 (primary, bg, text, border, danger …) · light/dark  ← 컴포넌트가 쓴다
   ↓
tailwind-preset 3층 컴포넌트가 className 으로 소비
```

브랜드 프라이머리 = **Cobalt `#2563EB`**. 리브랜딩/다크모드는 `semantic.js` 매핑만 교체.

## 두 가지 소비 경로

**1) NativeWind className** (대부분의 UI) — F3에서 앱 `tailwind.config.js`:
```js
module.exports = { presets: [require("@clause-lens/tokens/tailwind-preset")], /* content … */ };
```
```tsx
<View className="bg-primary rounded-xl px-4 py-3" />
<Text className="text-primary-fg text-base" />
```

**2) TS 직접 import** (className 이 안 되는 곳 — 예: Skia 하이라이트 hex):
```ts
import { semantic, cobalt } from "@clause-lens/tokens";
const color = semantic.light.danger;   // "#DC2626"
```

## 참고
- 값의 소스는 `*.js`(CJS). 타입은 `index.d.ts`. 빌드 단계 없음(tailwind·앱·Skia 모두 바로 require/import).
- 커스텀 폰트 파일 로딩(expo-font)은 앱에서. 여기선 폰트 별칭·스케일 토큰만.
- 다크모드 적용 전략(`dark:` variant vs CSS 변수)은 F3에서 확정.
