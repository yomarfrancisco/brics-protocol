export async function addr(c: any) { 
  return c.getAddress(); 
}

export async function approve20(token: any, signer: any, spender: any, amt: bigint) {
  return token.connect(signer).approve(await addr(spender), amt);
}
