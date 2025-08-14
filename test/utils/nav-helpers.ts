export const WAD = 10n ** 18n;
export const RAY = 10n ** 27n;

export function wadToRay(wad: bigint) { 
    return wad * (RAY / WAD); 
}

export async function setNavCompat(oracle: any, navWad: bigint) {
    // Prefer setNAV(wad) if available, else setNavRay(ray)
    if (typeof oracle?.setNAV === 'function') {
        return oracle.setNAV(navWad);
    }
    const ray = wadToRay(navWad);
    return oracle.setNavRay(ray);
}

export async function getNavRayCompat(oracle: any) {
    // Some mocks use navRay(), some getNavRay()
    if (typeof oracle?.navRay === 'function') return oracle.navRay();
    if (typeof oracle?.getNavRay === 'function') return oracle.getNavRay();
    if (typeof oracle?.latestNAVRay === 'function') return oracle.latestNAVRay();
    throw new Error('Oracle has no navRay/getNavRay/latestNAVRay');
}
