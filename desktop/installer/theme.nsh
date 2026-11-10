; NSIS uses native Win32 dialogs, not HTML. This palette is generated from the
; main application's client/src/index.css before every Windows package build.
!include "${PROJECT_DIR}\generated-artifacts\installer-theme\theme.nsh"
!include "MUI2.nsh"
!include "LogicLib.nsh"

; Avoid Windows DPI virtualization, which makes installer fonts blurry.
; NSIS retains fixed-size bitmaps, so the main icon artwork stays crisp.
ManifestDPIAware true

!define MUI_BGCOLOR "${ROVER_BG}"
!define MUI_TEXTCOLOR "${ROVER_TEXT}"
!define MUI_DIRECTORYPAGE_BGCOLOR "${ROVER_PANEL}"
!define MUI_DIRECTORYPAGE_TEXTCOLOR "${ROVER_TEXT}"
!define MUI_LICENSEPAGE_BGCOLOR "${ROVER_PANEL}"
!define MUI_LICENSEPAGE_TEXTCOLOR "${ROVER_TEXT}"
!define MUI_INSTFILESPAGE_COLORS "${ROVER_ACCENT} ${ROVER_BG}"

; MUI has per-page callbacks but no global page-show callback. Keep its original
; callback/undef contract, adding our theme pass on every native page (including
; electron-builder's install-mode page). Do not replace its install/UAC logic.
!ifmacrodef MUI_PAGE_FUNCTION_CUSTOM
  !macroundef MUI_PAGE_FUNCTION_CUSTOM
!else
  !error "Unsupported NSIS Modern UI: the page callback contract has changed."
!endif
!macro MUI_PAGE_FUNCTION_CUSTOM TYPE
  !if "${TYPE}" S== "SHOW"
    !ifdef BUILD_UNINSTALLER
      Call un.RoverThemePage
    !else
      Call RoverThemePage
    !endif
  !endif
  !ifdef MUI_PAGE_CUSTOMFUNCTION_${TYPE}
    Call "${MUI_PAGE_CUSTOMFUNCTION_${TYPE}}"
    !undef MUI_PAGE_CUSTOMFUNCTION_${TYPE}
  !endif
!macroend

!macro RoverThemeFunctions PREFIX
  Function ${PREFIX}RoverThemeTree
    Exch $0
    Push $1
    Push $2
    SetCtlColors $0 "${ROVER_TEXT}" "${ROVER_BG}"
    System::Call 'user32::GetClassNameW(p r0, w .r2, i 128)'
    ${If} $2 == "Edit"
      SetCtlColors $0 "${ROVER_TEXT}" "${ROVER_PANEL}"
    ${ElseIf} $2 == "Button"
      ; Native themed checkboxes ignore SetCtlColors for their label text.
      ; Disable theming only on checkbox/radio controls so MUI's dark-page
      ; foreground remains legible; ordinary Windows buttons keep native style.
      System::Call 'user32::GetWindowLongW(p r0, i -16) i.r2'
      IntOp $2 $2 & 0xF
      ${If} $2 == 2
      ${OrIf} $2 == 3
      ${OrIf} $2 == 4
      ${OrIf} $2 == 5
      ${OrIf} $2 == 7
      ${OrIf} $2 == 9
      ${OrIf} $2 == 10
        System::Call 'uxtheme::SetWindowTheme(p r0, w" ", w" ")'
        SetCtlColors $0 "${ROVER_TEXT}" "${ROVER_BG}"
      ${EndIf}
    ${ElseIf} $2 == "msctls_progress32"
      ; The themed Windows progress bar ignores PBM_SETBARCOLOR. Disable its
      ; visual style only on this control, then apply the CSS-derived cyan.
      System::Call 'uxtheme::SetWindowTheme(p r0, w" ", w" ")'
      SendMessage $0 0x0409 0 0x${ROVER_ACCENT_WIN32}
      SendMessage $0 0x2001 0 0x${ROVER_BG_WIN32}
    ${EndIf}
    System::Call 'user32::GetWindow(p r0, i 5) p.r1'
    ${DoWhile} $1 != 0
      Push $1
      Call ${PREFIX}RoverThemeTree
      System::Call 'user32::GetWindow(p r1, i 2) p.r1'
    ${Loop}
    Pop $2
    Pop $1
    Pop $0
  FunctionEnd

  Function ${PREFIX}RoverThemePage
    Push $0
    Push $HWNDPARENT
    Call ${PREFIX}RoverThemeTree
    GetDlgItem $0 $HWNDPARENT 1037
    SetCtlColors $0 "${ROVER_ACCENT}" "${ROVER_BG}"
    ; Dark caption on supported Windows versions. This changes only our window,
    ; never system-wide colors, firewall rules or security settings.
    System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4)'
    Pop $0
  FunctionEnd
!macroend

!ifdef BUILD_UNINSTALLER
  !define MUI_CUSTOMFUNCTION_UNGUIINIT un.RoverThemePage
  !insertmacro RoverThemeFunctions "un."
!else
  !define MUI_CUSTOMFUNCTION_GUIINIT RoverThemePage
  !insertmacro RoverThemeFunctions ""
!endif
