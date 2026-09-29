import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export const DropdownMenuContent = ({ className = '', sideOffset = 10, style = {}, ...props }) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      sideOffset={sideOffset}
      className={`dropdown-content z-[9999] min-w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-2xl ${className}`}
      style={{ backgroundColor: '#ffffff', opacity: 1, ...style }}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
);

export const DropdownMenuItem = ({ className = '', ...props }) => (
  <DropdownMenuPrimitive.Item
    className={`dropdown-item relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-2 text-xs outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`}
    {...props}
  />
);

export const DropdownMenuLabel = ({ className = '', ...props }) => (
  <DropdownMenuPrimitive.Label
    className={`dropdown-label px-2.5 py-1.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase ${className}`}
    {...props}
  />
);

export const DropdownMenuSeparator = ({ className = '', ...props }) => (
  <DropdownMenuPrimitive.Separator
    className={`dropdown-separator -mx-1 my-1.5 h-px bg-slate-200 ${className}`}
    {...props}
  />
);
