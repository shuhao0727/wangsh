/**
 * antd icon → lucide-react 映射表
 *
 * 使用方法：迁移某个文件时，将 antd icon import 替换为对应的 lucide import。
 * 示例：
 *   import { PlusOutlined } // @ant-design/icons
 *     ↓
 *   import { Plus } from "lucide-react";
 *
 * 注意：lucide 图标默认 size=24，antd 默认 14-16px。
 * 请在使用时加 className="h-4 w-4" 保持一致。
 */

// antd icon name → lucide component name
export const iconMap: Record<string, string> = {
  // 操作类
  PlusOutlined: "Plus",
  DeleteOutlined: "Trash2",
  EditOutlined: "Pencil",
  SaveOutlined: "Save",
  CopyOutlined: "Copy",
  DownloadOutlined: "Download",
  UploadOutlined: "Upload",
  SearchOutlined: "Search",
  FilterOutlined: "Filter",
  ReloadOutlined: "RefreshCw",
  SyncOutlined: "RefreshCw",
  RedoOutlined: "Redo",
  CloseOutlined: "X",
  CheckOutlined: "Check",
  ExpandOutlined: "Maximize2",
  DragOutlined: "GripVertical",
  HolderOutlined: "GripVertical",
  MoreOutlined: "MoreHorizontal",
  ClearOutlined: "XCircle",
  SendOutlined: "Send",

  // 方向/导航
  ArrowLeftOutlined: "ArrowLeft",
  ArrowRightOutlined: "ArrowRight",
  ArrowUpOutlined: "ArrowUp",
  ArrowDownOutlined: "ArrowDown",
  LeftOutlined: "ChevronLeft",
  RightOutlined: "ChevronRight",
  DownOutlined: "ChevronDown",

  // 状态/反馈
  CheckCircleOutlined: "CheckCircle",
  CheckCircleFilled: "CheckCircle",
  CloseCircleOutlined: "XCircle",
  CloseCircleFilled: "XCircle",
  WarningOutlined: "AlertTriangle",
  LoadingOutlined: "Loader2",
  ClockCircleOutlined: "Clock",

  // 用户/权限
  UserOutlined: "User",
  UserAddOutlined: "UserPlus",
  TeamOutlined: "Users",
  LockOutlined: "Lock",
  KeyOutlined: "Key",
  LoginOutlined: "LogIn",
  LogoutOutlined: "LogOut",
  SafetyOutlined: "Shield",

  // 内容类型
  FileTextOutlined: "FileText",
  FolderOutlined: "Folder",
  BookOutlined: "BookOpen",
  PictureOutlined: "Image",
  LinkOutlined: "Link",
  InboxOutlined: "Inbox",
  MessageOutlined: "MessageSquare",

  // 功能/模块
  HomeOutlined: "Home",
  DashboardOutlined: "LayoutDashboard",
  SettingOutlined: "Settings",
  AppstoreOutlined: "LayoutGrid",
  RobotOutlined: "Bot",
  CodeOutlined: "Code",
  LaptopOutlined: "Laptop",
  DatabaseOutlined: "Database",
  MonitorOutlined: "Monitor",
  ApiOutlined: "Plug",
  CloudOutlined: "Cloud",
  ConsoleSqlOutlined: "Terminal",
  BranchesOutlined: "GitBranch",
  NodeIndexOutlined: "GitMerge",
  ApartmentOutlined: "Network",
  ControlOutlined: "Sliders",
  BugOutlined: "Bug",

  // 编辑/排版
  BoldOutlined: "Bold",
  ItalicOutlined: "Italic",
  OrderedListOutlined: "ListOrdered",
  UnorderedListOutlined: "List",
  ColumnWidthOutlined: "Columns",

  // 数据/图表
  BarChartOutlined: "BarChart3",
  PieChartOutlined: "PieChart",

  // 媒体/播放
  PlayCircleOutlined: "PlayCircle",
  PauseCircleOutlined: "PauseCircle",
  StopOutlined: "Square",
  SoundOutlined: "Volume2",
  FastForwardOutlined: "FastForward",

  // 表单
  FormOutlined: "ClipboardEdit",
  CalendarOutlined: "Calendar",
  EyeOutlined: "Eye",
  PushpinOutlined: "Pin",
  PushpinFilled: "Pin",

  // 科学/实验
  ExperimentOutlined: "FlaskConical",
  ThunderboltOutlined: "Zap",
  RocketOutlined: "Rocket",
  TrophyOutlined: "Trophy",

  // 布局
  MenuOutlined: "Menu",
  MenuFoldOutlined: "PanelLeftClose",
  MenuUnfoldOutlined: "PanelLeftOpen",
  HistoryOutlined: "History",

  // 缩放
  ZoomInOutlined: "ZoomIn",
  ZoomOutOutlined: "ZoomOut",

  // 其他
  MinusOutlined: "Minus",
};
