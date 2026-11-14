Fonts for the PHOSPHOR layout (registered app-wide by Herdr from this folder).
Source: github.com/google/fonts (main), downloaded 2026-11-13.

  ShareTechMono-Regular.ttf      family "Share Tech Mono"  unmodified       SIL OFL 1.1 (OFL-ShareTechMono.txt)
  VT323-Regular.ttf              family "VT323"            unmodified       SIL OFL 1.1 (OFL-VT323.txt)
  PHWordmark-Regular.ttf         family "PH Wordmark"      MODIFIED: Orbitron[wght] instanced at wght=900 (Black),
                                                           subset to ASCII U+0020-007E, renamed because "Orbitron"
                                                           is an OFL Reserved Font Name. SIL OFL 1.1 (OFL-Orbitron.txt)
  KosugiMaru-Regular-subset.ttf  family "Kosugi Maru"      MODIFIED: subset to ASCII, U+3000, katakana U+30A0-30FF and
                                                           稼働要求完了待機端末節点常駐記録計測起動. Apache 2.0 (LICENSE-KosugiMaru.txt)

Re-subset Kosugi Maru (needs the original from google/fonts apache/kosugimaru):
  pyftsubset KosugiMaru-Regular.ttf --text="稼働要求完了待機端末節点常駐記録計測起動" \
    --unicodes="U+0020-007E,U+3000,U+30A0-30FF" --layout-features='*' --output-file=KosugiMaru-Regular-subset.ttf
