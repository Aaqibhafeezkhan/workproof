class Workproof < Formula
  desc "Verifiable engineering report from git history, without showing code"
  homepage "https://github.com/Bubblegunn/workproof"
  url "https://registry.npmjs.org/workproof/-/workproof-0.6.2.tgz"
  sha256 "d2b7de35698ac155a2f3a50ca715eec74274c72d7593cc0f62df62286d5dc421"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/workproof --version")
    assert_match "usage: workproof", shell_output("#{bin}/workproof --help")
  end
end
