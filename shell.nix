# Everything the site and the daily update need. Run `nix-shell` here to get it. nixpkgs is pinned, so this
# works the same on any NixOS install, whichever channel it follows and whether or not flakes are on. The
# pnpm here must match `packageManager` in package.json: pnpm would otherwise fetch that version into your
# home directory, which the report writer's sandbox can't read.
let
  pkgs = import (fetchTarball {
    # nixos-unstable on 2 November 2026.
    url = "https://github.com/NixOS/nixpkgs/archive/0bb2eedc20e4739f29e8045034f2828ad7054f8f.tar.gz";
    sha256 = "008j4dj5yrzww91qvp1lp2c9d1lkwc6i2dpainf5nkdkr3rwj8vy";
  }) { config = { }; overlays = [ ]; };
in
pkgs.mkShellNoCC {
  packages = [
    pkgs.nodejs_26
    pkgs.pnpm
    pkgs.gh
    pkgs.git
    pkgs.codex
  ];
  ASTRO_TELEMETRY_DISABLED = "1";
}
