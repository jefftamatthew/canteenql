// Reusable class strings for the CanteenQL controls.

export const btnOutline =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border-[1.5px] border-line-strong bg-white px-3.5 text-ink disabled:cursor-default disabled:opacity-45';
export const btnPrimary =
  'inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl border-0 bg-leaf px-5 text-[17px] font-bold text-white no-underline shadow-[0_3px_0_#1F5341] hover:text-white disabled:opacity-50';
export const btnDark =
  'inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-0 bg-ink px-5 font-bold text-white disabled:opacity-45';
export const btnPanel =
  'inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border-[1.5px] border-panel-btn bg-transparent px-3.5 text-[15px] text-panel-text no-underline hover:text-panel-text';
export const btnPanelLink =
  'inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-panel-btn px-3.5 text-[15px] text-leaf-kw no-underline hover:text-leaf-kw';
export const card = 'rounded-2xl border-[1.5px] border-line bg-white';
export const toggle = (on: boolean) =>
  `inline-flex min-h-11 min-w-[52px] cursor-pointer items-center justify-center rounded-[10px] border-[1.5px] px-3.5 ${
    on ? 'border-ink bg-ink font-bold text-white' : 'border-line-strong bg-white text-ink'
  }`;
export const tagWhere = 'self-start rounded-md bg-mustard-soft px-2 py-0.5 font-mono text-xs text-mustard-ink';
export const tagOrder = 'self-start rounded-md bg-plum-soft px-2 py-0.5 font-mono text-xs text-plum-ink';
export const selectBox = 'min-h-11 rounded-[10px] border-[1.5px] border-line-strong bg-white px-2.5 text-base text-ink';
