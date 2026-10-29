import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { tokens } from './tokens';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

// Nut chinh: vung cham toi thieu 44px, mau lay tu tokens, khong hard-code hex o noi khac.
export function Button({ children, style, ...props }: ButtonProps): ReactNode {
  return (
    <button
      {...props}
      style={{
        backgroundColor: tokens.colors.primary,
        border: 'none',
        borderRadius: tokens.radii.input,
        color: tokens.colors.primaryText,
        fontFamily: tokens.fontFamily,
        fontSize: tokens.fontSizes[2],
        minHeight: 44,
        padding: '12px 16px',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
