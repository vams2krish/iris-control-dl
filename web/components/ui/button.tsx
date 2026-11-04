import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:pointer-events-none disabled:opacity-40 cursor-pointer", {
  variants: { variant: { default: "bg-indigo-600 text-white hover:bg-indigo-500", outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50", ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-900" }, size: { default: "h-10 px-4 py-2", sm: "h-8 rounded-md px-3 text-xs", icon: "size-10" } }, defaultVariants: { variant: "default", size: "default" }
});
function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
export { Button, buttonVariants };
