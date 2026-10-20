# Records docs/demo.gif. Run it through scripts/record-demo.sh, which sets DEMO_BIN and DEMO_REPO.
Output docs/demo.gif
Set Shell "bash"
Set FontSize 15
Set Width 960
Set Height 600
Set Padding 16
Set TypingSpeed 35ms
Set Theme "Dracula"
Hide
Type "export PS1='$ ' PATH=$DEMO_BIN:$PATH K=9dc900a6227a1faaaa17d774565afbf3 && cd $DEMO_REPO && clear"
Enter
Show
Type "workproof --author 'Colin Francis' --sample 5 --fingerprint-key $K"
Enter
Sleep 4s
Type "workproof check workproof-report.json"
Enter
Sleep 2s
Type "workproof verify workproof-report.json --fingerprint-key $K | head -4"
Enter
Sleep 6s
Type "grep -A2 -E 'Share of commits|Surviving lines' workproof-report.md"
Enter
Sleep 8s
