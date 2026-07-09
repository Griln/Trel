; --- Themed uninstall + desktop shortcut for Trel ---

!macro customInstall
  CreateShortCut "$DESKTOP\Trel.lnk" "$INSTDIR\Trel.exe"
!macroend

!macro customInstallMode
  CreateShortCut "$DESKTOP\Trel.lnk" "$INSTDIR\Trel.exe"
!macroend

!macro customUnInit
  ReadEnvStr $0 APPDATA
  StrCpy $1 "mono"
  IfFileExists "$0\Trel\.theme" 0 show
  FileOpen $2 "$0\Trel\.theme" r
  IfErrors show
  FileRead $2 $1
  FileClose $2
  StrCpy $1 $1 -2
show:
  StrCmp $1 "eclipse" 0 +3
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 'Trel " Eclipse "$\n$\nUninstall Trel?$\nYour data stays safe in $0\Trel' IDYES done
    Abort
  StrCmp $1 "voxel" 0 +3
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 'Trel " Voxel "$\n$\nUninstall Trel?$\nYour data stays safe in $0\Trel' IDYES done
    Abort
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 'Trel " Mono "$\n$\nUninstall Trel?$\nYour data stays safe in $0\Trel' IDYES done
  Abort
  done:
!macroend

!macro customUnInstall
  Delete "$DESKTOP\Trel.lnk"
  ReadEnvStr $0 APPDATA
  IfFileExists "$0\Trel\.theme" 0 +2
    Delete "$0\Trel\.theme"
!macroend