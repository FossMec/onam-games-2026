{
  description = "foss-onam-games dev shell — supabase local only";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            supabase-cli
            openssl
          ];

          shellHook = ''
            # Auto-export Google OAuth for supabase local (reads env at start)
            if [ -f .env ]; then
              set -a; source .env 2>/dev/null; set +a
              export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID="''${SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID:-$GOOGLE_OAUTH_CLIENT_ID}"
              export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET="''${SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET:-$GOOGLE_OAUTH_CLIENT_SECRET}"
            fi
            echo "✓ dev shell ready — supabase $(supabase --version 2>/dev/null | head -n1)"
            echo "  Run: supabase start    # needs docker daemon running"
            echo "  Then: supabase status  # get API URL / DB URL / keys for .env"
          '';
        };
      });
}
