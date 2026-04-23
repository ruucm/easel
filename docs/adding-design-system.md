# 새 디자인 시스템 추가 가이드

## 개요

이 프로젝트는 **어댑터 패턴**으로 디자인 시스템을 관리합니다.
새 DS를 추가하려면 어댑터 파일 1개 생성 + init.ts에 import 1줄만 추가하면 됩니다.

## 파일 구조

```
app/design-systems/
├── types.ts        # DesignSystemAdapter 인터페이스 (수정 불필요)
├── registry.ts     # 어댑터 등록/조회 (수정 불필요)
├── context.tsx     # React Context (수정 불필요)
├── init.ts         # ★ 여기에 import 추가
├── html.tsx        # Generic HTML 어댑터
├── shadcn.tsx      # shadcn/ui 어댑터
├── mui.tsx         # Material UI 어댑터
└── yourds.tsx      # ★ 새 어댑터 파일 생성
```

## Step 1: 어댑터 파일 생성

`app/design-systems/yourds.tsx` 파일을 생성합니다.

```tsx
"use client";

import React from "react";
import type { DesignSystemAdapter, ComponentTemplate } from "./types";
import type { CanvasNode } from "../store/types";
import { registerDesignSystem } from "./registry";

// 외부 라이브러리 import (있다면)
// import { Button, Input } from "your-design-system";
```

## Step 2: 컴포넌트 렌더러 구현

`renderComponent`는 캔버스에 컴포넌트를 그리는 핵심 함수입니다.

```tsx
function renderComponent(node: CanvasNode): React.ReactNode {
  const p = (node.componentProps || {}) as Record<string, any>;

  switch (node.type) {
    case "YourButton":
      return (
        <button style={{ padding: "8px 16px", borderRadius: 6 }}>
          {p.label || "Button"}
        </button>
      );

    case "YourInput":
      return (
        <input
          placeholder={p.placeholder || "Enter text..."}
          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
        />
      );

    case "YourCard":
      return (
        <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <h3>{p.title || "Card Title"}</h3>
          <p>{p.content || "Card content"}</p>
        </div>
      );

    default:
      return null; // Frame, Text 등은 캔버스가 처리
  }
}
```

**규칙:**
- `node.type`으로 분기하여 JSX 반환
- `node.componentProps`에서 props 읽기
- Frame/Text 타입은 `null` 반환 (캔버스가 직접 처리)
- 기본값을 항상 제공 (`p.label || "Button"`)

## Step 3: 카탈로그 정의

좌측 Assets 패널에 표시되는 컴포넌트 목록입니다.

```tsx
// 아이콘 헬퍼
const S = ({ children, ...p }: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
       stroke="currentColor" strokeWidth="1.5"
       strokeLinecap="round" strokeLinejoin="round" {...p}>
    {children}
  </svg>
);

// 고유 ID 생성기 (다른 DS와 겹치지 않게 시작값 조정)
let counter = 9000;
function uid() {
  return `yourds-${++counter}-${Date.now()}`;
}

const catalog: ComponentTemplate[] = [
  {
    type: "YourButton",
    label: "Button",
    icon: <S><rect x="2" y="4" width="12" height="8" rx="2" /></S>,
    create: (cx, cy) => ({
      id: uid(),
      type: "YourButton",
      name: "Button",
      style: { position: "absolute" as const, left: cx, top: cy },
      componentProps: { label: "Click me", variant: "primary" },
      children: [],
    }),
  },
  {
    type: "YourInput",
    label: "Input",
    icon: <S><rect x="1" y="4" width="14" height="8" rx="2" /><line x1="4" y1="8" x2="4" y2="8" /></S>,
    create: (cx, cy) => ({
      id: uid(),
      type: "YourInput",
      name: "Input",
      style: { position: "absolute" as const, left: cx, top: cy, width: 240 },
      componentProps: { placeholder: "Enter text...", label: "Label" },
      children: [],
    }),
  },
  {
    type: "YourCard",
    label: "Card",
    icon: <S><rect x="1" y="2" width="14" height="12" rx="2" /></S>,
    create: (cx, cy) => ({
      id: uid(),
      type: "YourCard",
      name: "Card",
      style: { position: "absolute" as const, left: cx, top: cy, width: 300 },
      componentProps: { title: "Card Title", content: "Card content goes here." },
      children: [],
    }),
  },
];
```

**카탈로그 항목 구조:**
- `type`: renderComponent의 switch case와 일치해야 함
- `label`: Assets 패널에 표시되는 이름
- `icon`: 16x16 SVG 아이콘
- `create(cx, cy)`: 캔버스 클릭 시 생성할 노드 팩토리 함수

## Step 4: AI 스키마 작성

AI가 디자인을 생성할 때 참고하는 스키마입니다.

```tsx
const aiSchema = `Design System: Your Design System

A CanvasNode has this structure:
{
  id: string,
  type: "Frame" | "Text" | "YourButton" | "YourInput" | "YourCard",
  name: string (descriptive layer name),
  style: React.CSSProperties,
  children: CanvasNode[],
  text?: string (only for Text nodes),
  componentProps?: {
    // YourButton: { label: string, variant?: "primary" | "secondary" | "danger", disabled?: boolean }
    // YourInput: { placeholder?: string, label?: string, type?: "text" | "email" | "password" }
    // YourCard: { title: string, content?: string }
  }
}

Rules:
- Use Frame (type: "Frame") for layout containers. Give it display: "flex", flexDirection, gap, padding, etc.
- Use Text (type: "Text") for any text. Set the "text" field and style fontSize, fontWeight, color.
- Generate unique IDs like "yourds-N-timestamp".
- Always wrap designs in a root Frame with proper layout styles.
`;
```

**잘 작성하면 AI가 더 정확한 디자인을 생성합니다.** 각 컴포넌트의 props를 빠짐없이 문서화하세요.

## Step 5: Export 설정

디자인을 Vite 프로젝트로 내보낼 때 사용하는 설정입니다.

```tsx
const IMPORTABLE = new Set(["YourButton", "YourInput", "YourCard"]);

const exportConfig = {
  // npm 패키지 정보 (외부 라이브러리 사용 시)
  packageName: "your-design-system",    // 또는 "" (외부 패키지 없을 때)
  packageVersion: "^1.0.0",             // 또는 ""

  // 추가 의존성
  extraDependencies: {
    // "@emotion/react": "^11.0.0",     // 필요한 경우
  },

  // HTML data-theme 속성 (테마 전환용)
  dataTheme: undefined,                  // 또는 "your-theme"

  // CSS import 문
  cssImports: [
    // "import 'your-design-system/styles.css';",
  ],

  // public/ 에서 가져올 테마 CSS 경로
  themeCSSPath: undefined,               // 또는 "/your-theme.css"

  // import 문 생성 함수
  generateImport: (usedTypes: string[]) => {
    if (usedTypes.length === 0) return "";
    return `import { ${usedTypes.join(", ")} } from "your-design-system";`;
  },

  // import가 필요한 컴포넌트 타입 (Frame, Text 제외)
  importableTypes: IMPORTABLE,
};
```

## Step 6: 어댑터 객체 조립 & 등록

```tsx
const yourdsAdapter: DesignSystemAdapter = {
  id: "yourds",
  name: "Your Design System",
  description: "My awesome design system",
  accentColor: "#7c3aed",  // UI 강조색 (hex)
  fontFamily: "var(--font-inter), Inter, sans-serif",  // 캔버스 폰트

  renderComponent,
  catalog,
  aiSchema,
  exportConfig,

  // (선택) DS 전환 시 기본 표시할 노드
  // defaultNodes: [...],
};

// 등록 (import 시 자동 실행)
registerDesignSystem(yourdsAdapter);

export default yourdsAdapter;
```

## Step 7: init.ts에 등록

`app/design-systems/init.ts`에 import 한 줄 추가:

```ts
import "./html";
import "./shadcn";
import "./mui";
import "./yourds";  // ← 추가
```

## Step 8: 폰트 추가 (선택)

커스텀 Google Font가 필요한 경우 `app/layout.tsx`에 추가:

```tsx
import { Geist, Geist_Mono, Inter, Roboto, YourFont } from "next/font/google";

const yourFont = YourFont({
  variable: "--font-yourfont",
  subsets: ["latin"],
});
```

`<html>` 태그의 className에 `${yourFont.variable}` 추가 후,
어댑터의 `fontFamily`에서 `"var(--font-yourfont), YourFont, sans-serif"` 사용.

---

## 전체 최소 템플릿

```tsx
"use client";

import React from "react";
import type { DesignSystemAdapter, ComponentTemplate } from "./types";
import type { CanvasNode } from "../store/types";
import { registerDesignSystem } from "./registry";

// ── Renderer ──
function renderComponent(node: CanvasNode): React.ReactNode {
  const p = (node.componentProps || {}) as Record<string, any>;
  switch (node.type) {
    case "MyButton":
      return <button>{p.label || "Button"}</button>;
    default:
      return null;
  }
}

// ── Helpers ──
const S = ({ children, ...p }: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
       stroke="currentColor" strokeWidth="1.5" {...p}>{children}</svg>
);

let counter = 9000;
function uid() { return `myds-${++counter}-${Date.now()}`; }

// ── Catalog ──
const catalog: ComponentTemplate[] = [
  {
    type: "MyButton",
    label: "Button",
    icon: <S><rect x="2" y="4" width="12" height="8" rx="2" /></S>,
    create: (cx, cy) => ({
      id: uid(), type: "MyButton", name: "Button",
      style: { position: "absolute" as const, left: cx, top: cy },
      componentProps: { label: "Click me" },
      children: [],
    }),
  },
];

// ── AI Schema ──
const aiSchema = `Design System: My DS
{ type: "MyButton", componentProps: { label: string } }`;

// ── Export ──
const exportConfig = {
  packageName: "", packageVersion: "",
  generateImport: () => "",
  importableTypes: new Set<string>(),
};

// ── Adapter ──
const mydsAdapter: DesignSystemAdapter = {
  id: "myds",
  name: "My DS",
  description: "My design system",
  accentColor: "#7c3aed",
  renderComponent, catalog, aiSchema, exportConfig,
};

registerDesignSystem(mydsAdapter);
export default mydsAdapter;
```

---

## 체크리스트

| # | 할 일 | 파일 |
|---|-------|------|
| 1 | 어댑터 파일 생성 | `app/design-systems/yourds.tsx` |
| 2 | `renderComponent` 구현 | 위 파일 |
| 3 | `catalog` 정의 | 위 파일 |
| 4 | `aiSchema` 작성 | 위 파일 |
| 5 | `exportConfig` 설정 | 위 파일 |
| 6 | `registerDesignSystem()` 호출 | 위 파일 하단 |
| 7 | init.ts에 import 추가 | `app/design-systems/init.ts` |
| 8 | (선택) 폰트 추가 | `app/layout.tsx` |
| 9 | 빌드 확인 | `npx next build` |

## 기존 어댑터 참고

| 어댑터 | 복잡도 | 특징 | 참고용으로 |
|--------|--------|------|-----------|
| `html.tsx` | 낮음 | 외부 의존성 없음, inline styles | 기본 구조 이해 |
| `shadcn.tsx` | 중간 | 로컬 컴포넌트 import | Tailwind 기반 DS |
| `mui.tsx` | 높음 | 외부 npm 패키지 사용 | 외부 라이브러리 DS |
