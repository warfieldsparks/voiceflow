#include <windows.h>
#include <stdio.h>
#include <stdlib.h>

static HHOOK g_hook = NULL;
static HANDLE g_parent_process = NULL;
static HANDLE g_parent_watcher = NULL;
static DWORD g_main_thread_id = 0;

static BOOL g_ctrl_down = FALSE;
static BOOL g_win_down = FALSE;
static BOOL g_combo_active = FALSE;

static void emit_line(const char *line) {
  fputs(line, stdout);
  fputc('\n', stdout);
  fflush(stdout);
}

static BOOL is_ctrl_key(DWORD vk_code) {
  return vk_code == VK_LCONTROL || vk_code == VK_RCONTROL;
}

static BOOL is_win_key(DWORD vk_code) {
  return vk_code == VK_LWIN || vk_code == VK_RWIN;
}

static void sync_combo_state(void) {
  const BOOL next_combo_active = g_ctrl_down && g_win_down;
  if (next_combo_active == g_combo_active) {
    return;
  }

  g_combo_active = next_combo_active;
  emit_line(next_combo_active ? "DOWN" : "UP");
}

static DWORD WINAPI watch_parent_process(LPVOID param) {
  const HANDLE parent_process = (HANDLE)param;
  if (parent_process == NULL) {
    return 0;
  }

  WaitForSingleObject(parent_process, INFINITE);
  PostThreadMessage(g_main_thread_id, WM_QUIT, 0, 0);
  return 0;
}

static void maybe_start_parent_watcher(int argc, char **argv) {
  if (argc < 2) {
    return;
  }

  const DWORD parent_pid = (DWORD)strtoul(argv[1], NULL, 10);
  if (parent_pid == 0) {
    return;
  }

  g_parent_process = OpenProcess(SYNCHRONIZE, FALSE, parent_pid);
  if (g_parent_process == NULL) {
    return;
  }

  g_parent_watcher = CreateThread(NULL, 0, watch_parent_process, g_parent_process, 0, NULL);
}

static void cleanup(void) {
  if (g_hook != NULL) {
    UnhookWindowsHookEx(g_hook);
    g_hook = NULL;
  }

  if (g_parent_watcher != NULL) {
    CloseHandle(g_parent_watcher);
    g_parent_watcher = NULL;
  }

  if (g_parent_process != NULL) {
    CloseHandle(g_parent_process);
    g_parent_process = NULL;
  }
}

static LRESULT CALLBACK keyboard_hook(int code, WPARAM w_param, LPARAM l_param) {
  if (code < HC_ACTION) {
    return CallNextHookEx(NULL, code, w_param, l_param);
  }

  KBDLLHOOKSTRUCT *event = (KBDLLHOOKSTRUCT *)l_param;
  const DWORD vk_code = event->vkCode;
  const BOOL key_down = w_param == WM_KEYDOWN || w_param == WM_SYSKEYDOWN;
  const BOOL key_up = w_param == WM_KEYUP || w_param == WM_SYSKEYUP;
  const BOOL ctrl_key = is_ctrl_key(vk_code);
  const BOOL win_key = is_win_key(vk_code);

  const BOOL was_ctrl_down = g_ctrl_down;
  const BOOL was_win_down = g_win_down;
  const BOOL was_combo_active = g_combo_active;
  BOOL swallow = FALSE;

  if (ctrl_key) {
    if (key_down) {
      g_ctrl_down = TRUE;
    } else if (key_up) {
      g_ctrl_down = FALSE;
    }
    sync_combo_state();
  } else if (win_key) {
    if (key_down) {
      g_win_down = TRUE;
    } else if (key_up) {
      g_win_down = FALSE;
    }
    sync_combo_state();
  }

  if (win_key) {
    if (key_down && (was_ctrl_down || g_ctrl_down || was_combo_active || g_combo_active)) {
      swallow = TRUE;
    }

    if (key_up && (was_combo_active || was_ctrl_down || g_ctrl_down || g_combo_active)) {
      swallow = TRUE;
    }
  } else if (ctrl_key) {
    if (key_down && (was_win_down || g_win_down || was_combo_active || g_combo_active)) {
      swallow = TRUE;
    }

    if (key_up && (was_combo_active || was_win_down || g_win_down || g_combo_active)) {
      swallow = TRUE;
    }
  }

  if (swallow) {
    return 1;
  }

  return CallNextHookEx(NULL, code, w_param, l_param);
}

int main(int argc, char **argv) {
  MSG msg;

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
  setvbuf(stdout, NULL, _IONBF, 0);
  g_main_thread_id = GetCurrentThreadId();

  PeekMessage(&msg, NULL, WM_USER, WM_USER, PM_NOREMOVE);
  maybe_start_parent_watcher(argc, argv);

  g_hook = SetWindowsHookExA(WH_KEYBOARD_LL, keyboard_hook, GetModuleHandle(NULL), 0);
  if (g_hook == NULL) {
    fprintf(stderr, "Failed to install keyboard hook: %lu\n", GetLastError());
    return 1;
  }

  emit_line("READY");

  while (GetMessage(&msg, NULL, 0, 0) > 0) {
    TranslateMessage(&msg);
    DispatchMessage(&msg);
  }

  cleanup();
  return 0;
}
