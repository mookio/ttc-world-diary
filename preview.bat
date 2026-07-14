@echo off
setlocal
cd /d "%~dp0"
set "PYTHON_EXE="
for /f "tokens=2,*" %%a in ('reg query "HKCU\Software\Python\PythonCore\3.12\InstallPath" /ve 2^>nul') do if exist "%%bpython.exe" set "PYTHON_EXE=%%bpython.exe"
if not defined PYTHON_EXE for /f "tokens=2,*" %%a in ('reg query "HKCU\Software\Python\PythonCore\3.12\InstallPath" /ve 2^>nul') do if exist "%%b\python.exe" set "PYTHON_EXE=%%b\python.exe"
if not defined PYTHON_EXE (
  echo Python 3.12 not found.
  exit /b 1
)
echo Open http://127.0.0.1:8765/
"%PYTHON_EXE%" -m http.server 8765
