"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

// native date/time/datetime-local/month/week 입력의 클릭 UX 보완.
// 기본 input은 우측 picker 아이콘만 클릭 가능 — 입력 영역 어디를 클릭해도
// picker가 열리도록 showPicker() 호출.
// (Chrome 99+, Firefox 101+, Safari 16+ 지원. optional chaining으로 fallback.)

type Props = InputHTMLAttributes<HTMLInputElement>;

export const NativePickerInput = forwardRef<HTMLInputElement, Props>(
  function NativePickerInput({ onClick, ...rest }, ref) {
    return (
      <input
        ref={ref}
        onClick={(e) => {
          e.currentTarget.showPicker?.();
          onClick?.(e);
        }}
        {...rest}
      />
    );
  },
);
