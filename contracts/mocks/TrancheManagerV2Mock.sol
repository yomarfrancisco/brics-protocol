// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TrancheManagerV2Mock {
    uint256 private _cap;
    uint16 private _lo = 10000;
    uint16 private _hi = 10000;
    uint256 private _last;

    constructor(uint256 cap_) { _cap = cap_; _last = block.timestamp; }

    function superSeniorCap() external view returns (uint256) { return _cap; }
    function setSuperSeniorCap(uint256 v) external { _cap = v; }

    function getEffectiveDetachment() external view returns (uint16, uint16) { return (_lo, _hi); }
    function lastDetachmentUpdateTs() external view returns (uint256) { return _last; }

    function issuanceLocked() external pure returns (bool) { return false; }
    function setIssuanceLocked(bool) external { /* noop for tests */ }
}
