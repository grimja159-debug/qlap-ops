@echo off
setlocal
cd /d "%~dp0"
echo ===========================================================
echo  START qlap-ops admin preview
echo ===========================================================
echo  URL: http://localhost:5173/admin
echo  This uses the built dist preview, not Vite dev HMR.
echo ===========================================================
echo.
cmd /c pnpm.cmd run build
if errorlevel 1 (
  echo.
  echo Build failed. Check the output above.
  pause
  exit /b 1
)
echo.
echo Starting preview server on localhost:5173 ...
cmd /c pnpm.cmd exec vite preview --host localhost --port 5173
endlocal
