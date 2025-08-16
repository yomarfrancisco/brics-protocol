/** Return the tuple we will pass to mintFor for debug purposes */
export function echoMintArgs(
  to: string,
  usdcAmt: bigint,
  tailCorrBps: bigint,
  sovereignUtilBps: bigint,
  tag: `0x${string}`
) {
  return { to, usdcAmt, tailCorrBps, sovereignUtilBps, tag };
}
