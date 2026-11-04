using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

// Fixed command protocol over inherited stdin. No listening socket, shell commands,
// arbitrary key strings, image access or window-content access are exposed.
internal static class Program {
    [STAThread] private static void Main(string[] args) {
        try { Native.SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { Native.SetProcessDPIAware(); }
        Application.EnableVisualStyles();
        bool dryRun = Array.IndexOf(args, "--dry-run") >= 0;
        Overlay overlay = new Overlay(dryRun);
        if (dryRun) Application.Run(); else Application.Run(overlay);
    }
}
internal sealed class Overlay : Form {
    private readonly bool dryRun;
    private readonly ConcurrentQueue<string> queue = new ConcurrentQueue<string>();
    private readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    private readonly Stopwatch clock = Stopwatch.StartNew();
    private readonly Rectangle screenBounds = Screen.PrimaryScreen.Bounds;
    private bool enabled, held, drawn, emergency, shortcutRegistered;
    private long heartbeat, releaseAt;
    private int cursorX, cursorY;
    private float progress;
    private string mode = "cursor";
    private bool dragging;
    private const int HotKey = 7319;
    private readonly string[] labels = { "Pause", "Cursor", "Scroll", "Double", "Right", "Drag", "Keyboard", "Back", "Next tab", "Apps" };

    public Overlay(bool dryRun) {
        this.dryRun = dryRun;
        FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false; TopMost = true;
        BackColor = Color.Magenta; TransparencyKey = Color.Magenta;
        StartPosition = FormStartPosition.Manual; Bounds = screenBounds; DoubleBuffered = true;
        if (!dryRun) {
            shortcutRegistered = Native.RegisterHotKey(Handle, HotKey, 0x4003, (uint)Keys.F8); // Ctrl+Alt+F8
            if (!shortcutRegistered) { Console.WriteLine("ERROR emergency_shortcut_unavailable"); Environment.Exit(2); }
        }
        Console.WriteLine("READY " + screenBounds.X + " " + screenBounds.Y + " " + screenBounds.Width + " " + screenBounds.Height);
        Console.Out.Flush();
        Thread input = new Thread(delegate() {
            try { string line; while ((line = Console.ReadLine()) != null) { if (line.Length <= 180) queue.Enqueue(line); } }
            finally { queue.Enqueue("QUIT"); }
        });
        input.IsBackground = true; input.Start();
        timer.Interval = 20; timer.Tick += Tick; timer.Start();
        SystemEventsHook();
    }
    protected override bool ShowWithoutActivation { get { return true; } }
    protected override CreateParams CreateParams {
        get { CreateParams p = base.CreateParams; p.ExStyle |= 0x20 | 0x80 | 0x08000000; return p; }
    }
    protected override void WndProc(ref Message message) {
        if (message.Msg == 0x0312 && message.WParam.ToInt32() == HotKey) {
            emergency = true; Pause(); drawn = false; Console.WriteLine("EMERGENCY"); Console.Out.Flush(); Invalidate();
        }
        base.WndProc(ref message);
    }
    private void SystemEventsHook() {
        Microsoft.Win32.SystemEvents.SessionSwitch += delegate(object sender, Microsoft.Win32.SessionSwitchEventArgs e) {
            if (e.Reason == Microsoft.Win32.SessionSwitchReason.SessionLock) { emergency = true; Pause(); drawn = false; Console.WriteLine("EMERGENCY"); Console.Out.Flush(); }
        };
        Microsoft.Win32.SystemEvents.DisplaySettingsChanged += delegate { queue.Enqueue("DISPLAY_CHANGED"); };
    }
    private void Tick(object sender, EventArgs args) {
        string line;
        int budget = 120;
        while (budget-- > 0 && queue.TryDequeue(out line)) {
            try { HandleCommand(line); }
            catch (Exception) { Pause(); drawn = false; Console.WriteLine("ERROR native_input_failed"); Console.Out.Flush(); }
        }
        if (enabled && clock.ElapsedMilliseconds - heartbeat > 500) { Pause(); drawn = false; Console.WriteLine("STALE"); Console.Out.Flush(); }
        if (held && releaseAt > 0 && clock.ElapsedMilliseconds >= releaseAt) Release();
        Invalidate();
    }
    private void HandleCommand(string line) {
        string[] p = line.Split(' '); if (p.Length == 0) return;
        switch (p[0]) {
            case "QUIT": Pause(); if (shortcutRegistered) Native.UnregisterHotKey(Handle, HotKey); timer.Stop(); Application.Exit(); return;
            case "DISPLAY_CHANGED": emergency = true; Pause(); drawn = false; Console.WriteLine("DISPLAY_CHANGED"); Console.Out.Flush(); return;
            case "HEARTBEAT": heartbeat = clock.ElapsedMilliseconds; return;
            case "RESET": emergency = false; return;
            case "STATE":
                if (p.Length != 2 || p[1] != "1" || emergency || clock.ElapsedMilliseconds - heartbeat > 500) Pause(); else enabled = true;
                return;
            case "HIDE": drawn = false; return;
            case "DRAW":
                if (p.Length != 7) return;
                cursorX = ParseInt(p[1]); cursorY = ParseInt(p[2]);
                progress = Math.Max(0, Math.Min(1, float.Parse(p[3], CultureInfo.InvariantCulture)));
                mode = Array.IndexOf(new string[] { "cursor", "scroll", "double", "right", "drag" }, p[5]) >= 0 ? p[5] : "cursor"; dragging = p[6] == "1";
                drawn = screenBounds.Contains(cursorX, cursorY); return;
        }
        if (!enabled || emergency || clock.ElapsedMilliseconds - heartbeat > 500) return;
        if (dryRun) { Console.WriteLine("DRY " + line); Console.Out.Flush(); return; }
        switch (p[0]) {
            case "MOVE":
                if (p.Length != 3) return;
                int x = ParseInt(p[1]), y = ParseInt(p[2]);
                if (screenBounds.Contains(x, y) && !Native.SetCursorPos(x, y)) throw new InvalidOperationException();
                break;
            case "CLICK": InjectClick(false); break;
            case "DOUBLE": InjectClick(false); InjectClick(false); break;
            case "RIGHT": InjectClick(true); break;
            case "LONG": Release(); Native.Mouse(0x0002, 0); held = true; releaseAt = clock.ElapsedMilliseconds + 750; break;
            case "DOWN": Release(); Native.Mouse(0x0002, 0); held = true; releaseAt = 0; break;
            case "UP": Release(); break;
            case "SCROLL": if (p.Length == 2 && (p[1] == "120" || p[1] == "-120")) Native.Mouse(0x0800, ParseInt(p[1])); break;
            case "BACK": Native.Combo(0x12, 0x25); break;
            case "NEXTTAB": Native.Combo(0x11, 0x09); break;
            case "APPS": Native.Combo(0x12, 0x09); break;
            case "KEYBOARD": Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "osk.exe")) { UseShellExecute = true }); break;
        }
    }
    private static int ParseInt(string value) { return int.Parse(value, NumberStyles.Integer, CultureInfo.InvariantCulture); }
    private void InjectClick(bool right) { if (held) return; Native.Mouse(right ? 0x0008u : 0x0002u, 0); Native.Mouse(right ? 0x0010u : 0x0004u, 0); }
    private void Release() { if (held && !dryRun) Native.Mouse(0x0004, 0); held = false; releaseAt = 0; }
    private void Pause() { enabled = false; Release(); }
    protected override void OnPaint(PaintEventArgs e) {
        if (!drawn || dryRun) return;
        Graphics g = e.Graphics; g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        int width = Math.Min(1000, (int)Math.Floor(screenBounds.Width * .94));
        int left = (screenBounds.Width - width) / 2;
        using (Brush bg = new SolidBrush(Color.FromArgb(25, 30, 48))) g.FillRectangle(bg, left, 12, width, 54);
        using (Font font = new Font("Segoe UI", 10f)) using (Brush fg = new SolidBrush(Color.FromArgb(224, 231, 255))) {
            StringFormat format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            for (int i = 0; i < labels.Length; i++) {
                string label = i == 0 ? (enabled ? "Pause" : emergency ? "Stopped" : "Resume") : i == 5 && dragging ? "Drop" : labels[i];
                if (i == 1 && mode == "cursor" || i == 2 && mode == "scroll" || i == 3 && mode == "double" || i == 4 && mode == "right" || i == 5 && mode == "drag") label = "• " + label;
                g.DrawString(label, font, fg, new RectangleF(left + i * width / 10f, 12, width / 10f, 54), format);
            }
        }
        float cx = cursorX - screenBounds.X, cy = cursorY - screenBounds.Y;
        using (Pen pen = new Pen(Color.FromArgb(165, 180, 252), 3)) { g.DrawEllipse(pen, cx - 15, cy - 15, 30, 30); g.DrawArc(pen, cx - 21, cy - 21, 42, 42, -90, progress * 360); }
    }
}
internal static class Native {
    [DllImport("user32.dll")] internal static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] internal static extern bool SetProcessDPIAware();
    [DllImport("user32.dll", SetLastError = true)] internal static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll", SetLastError = true)] internal static extern bool RegisterHotKey(IntPtr hwnd, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] internal static extern bool UnregisterHotKey(IntPtr hwnd, int id);
    [DllImport("user32.dll", SetLastError = true)] private static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [StructLayout(LayoutKind.Sequential)] private struct MOUSEINPUT { public int dx, dy; public uint data, flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] private struct KEYBDINPUT { public ushort key, scan; public uint flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Explicit)] private struct UNION { [FieldOffset(0)] public MOUSEINPUT mouse; [FieldOffset(0)] public KEYBDINPUT keyboard; }
    [StructLayout(LayoutKind.Sequential)] private struct INPUT { public uint type; public UNION input; }
    private static void Send(INPUT[] inputs) { if (SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT))) != inputs.Length) throw new InvalidOperationException("Windows rejected input"); }
    internal static void Mouse(uint flags, int data) { Send(new INPUT[] { new INPUT { type = 0, input = new UNION { mouse = new MOUSEINPUT { flags = flags, data = unchecked((uint)data) } } } }); }
    internal static void Combo(ushort modifier, ushort key) {
        Send(new INPUT[] { Key(modifier, false), Key(key, false), Key(key, true), Key(modifier, true) });
    }
    private static INPUT Key(ushort key, bool up) { return new INPUT { type = 1, input = new UNION { keyboard = new KEYBDINPUT { key = key, flags = up ? 2u : 0u } } }; }
}
