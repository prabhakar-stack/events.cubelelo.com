"use client";

import { forwardRef, useId, useState } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600";

const ERROR_TEXT_CLASSES = "text-red-600 dark:text-red-400";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = "", type = "text", ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [show, setShow] = useState(false);
    const isPassword = type === "password";
    const resolvedType = isPassword && show ? "text" : type;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            className={`${FIELD_CLASSES} ${isPassword ? "pr-10" : ""} ${error ? "border-accent-danger focus:border-accent-danger focus:ring-accent-danger/30" : ""} ${className}`}
            {...rest}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? "Hide" : "Show"}
            </button>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className={`mt-1.5 text-xs ${ERROR_TEXT_CLASSES}`}>
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-zinc-500">
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, className = "", ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          className={`${FIELD_CLASSES} ${error ? "border-accent-danger focus:border-accent-danger focus:ring-accent-danger/30" : ""} ${className}`}
          {...rest}
        />
        {error && <p className={`mt-1.5 text-xs ${ERROR_TEXT_CLASSES}`}>{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className = "", children, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          className={`${FIELD_CLASSES} ${error ? "border-accent-danger" : ""} ${className}`}
          {...rest}
        >
          {children}
        </select>
        {error && <p className={`mt-1.5 text-xs ${ERROR_TEXT_CLASSES}`}>{error}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";

export const ERROR_TEXT_CLASS = ERROR_TEXT_CLASSES;
