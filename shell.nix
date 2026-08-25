{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  packages = with pkgs; [ supabase-cli ];
  shellHook = ''echo "shell.nix ready — supabase $(supabase --version 2>/dev/null | head -n1)"'';
}
