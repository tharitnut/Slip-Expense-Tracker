import { type HTMLAttributes } from "react";

type BadgeVariant = "default" | "primary" | "accent" | "error" | "success";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-ql-bg text-ql-muted border border-ql-border",
  primary: "bg-ql-primary-light text-ql-primary",
  accent: "bg-ql-accent-light text-ql-accent",
  error: "bg-ql-error-light text-ql-error",
  success: "bg-ql-success-light text-ql-success",
};

function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5
        text-xs font-medium rounded-full
        ${variantClasses[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge, type BadgeProps, type BadgeVariant };

