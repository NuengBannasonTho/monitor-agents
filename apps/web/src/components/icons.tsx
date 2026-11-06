import type { IconComponent, IconProps } from "reicon-react/createIcon";
import type { AgentState } from "@agent-office/shared";
import type { ActivityKind } from "../lib/activity-kind";
import { AnglesLeft } from "reicon-react/icons/AnglesLeft";
import { AngleDown } from "reicon-react/icons/AngleDown";
import { Moon } from "reicon-react/icons/Moon";
import { Sun } from "reicon-react/icons/Sun";
import { Hand } from "reicon-react/icons/Hand";
import { Flash } from "reicon-react/icons/Flash";
import { Coffee } from "reicon-react/icons/Coffee";
import { Bonfire } from "reicon-react/icons/Bonfire";
import { Briefcase } from "reicon-react/icons/Briefcase";
import { ForkKnife } from "reicon-react/icons/ForkKnife";
import { AlarmSleep } from "reicon-react/icons/AlarmSleep";
import { BookOpen } from "reicon-react/icons/BookOpen";
import { CloseCircle } from "reicon-react/icons/CloseCircle";
import { Cpu } from "reicon-react/icons/Cpu";
import { Desktop } from "reicon-react/icons/Desktop";
import { Send } from "reicon-react/icons/Send";
import { ArrowLeft } from "reicon-react/icons/ArrowLeft";
import { ArrowRight } from "reicon-react/icons/ArrowRight";
import { DocumentText } from "reicon-react/icons/DocumentText";
import { Eye } from "reicon-react/icons/Eye";
import { EyeSlash } from "reicon-react/icons/EyeSlash";
import { Monitor } from "reicon-react/icons/Monitor";
import { Folder } from "reicon-react/icons/Folder";
import { Gear } from "reicon-react/icons/Gear";
import { Buildings } from "reicon-react/icons/Buildings";
import { People } from "reicon-react/icons/People";
import { MagicStar } from "reicon-react/icons/MagicStar";
import { SidebarLeft } from "reicon-react/icons/SidebarLeft";
import { Plus } from "reicon-react/icons/Plus";
import { AddSquare } from "reicon-react/icons/AddSquare";
import { Trash } from "reicon-react/icons/Trash";
import { Warning } from "reicon-react/icons/Warning";
import { Refresh } from "reicon-react/icons/Refresh";
import { Palette } from "reicon-react/icons/Palette";
import { Hashtag } from "reicon-react/icons/Hashtag";
import { History } from "reicon-react/icons/History";
import { Hourglass } from "reicon-react/icons/Hourglass";
import { LaptopCode } from "reicon-react/icons/LaptopCode";
import { Layers } from "reicon-react/icons/Layers";
import { Menu } from "reicon-react/icons/Menu";
import { ListCheck } from "reicon-react/icons/ListCheck";
import { MessageText } from "reicon-react/icons/MessageText";
import { ChatRoundCall } from "reicon-react/icons/ChatRoundCall";
import { MoonSleep } from "reicon-react/icons/MoonSleep";
import { PenWriting } from "reicon-react/icons/PenWriting";
import { PlayCircle } from "reicon-react/icons/PlayCircle";
import { Pulse } from "reicon-react/icons/Pulse";
import { SearchNormal } from "reicon-react/icons/SearchNormal";
import { ShieldAlert } from "reicon-react/icons/ShieldAlert";
import { Timer } from "reicon-react/icons/Timer";
import { Tshirt } from "reicon-react/icons/Tshirt";
import { Users } from "reicon-react/icons/Users";
import { Bell } from "reicon-react/icons/Bell";
import { Check } from "reicon-react/icons/Check";
import { CodeSquare } from "reicon-react/icons/CodeSquare";
import { Copy } from "reicon-react/icons/Copy";
import { TerminalSquare } from "reicon-react/icons/TerminalSquare";
import { TickCircle } from "reicon-react/icons/TickCircle";
import { VolumeHigh } from "reicon-react/icons/VolumeHigh";
import { Xmark } from "reicon-react/icons/Xmark";
import { ChartSquare } from "reicon-react/icons/ChartSquare";
import { DollarCircle } from "reicon-react/icons/DollarCircle";
import { Coins } from "reicon-react/icons/Coins";
import { Sparkles } from "reicon-react/icons/Sparkles";
import { CommandSquare } from "reicon-react/icons/CommandSquare";
import { Data } from "reicon-react/icons/Data";

/*
 * The app's icons, all from Reicon (https://reicon.dev) in its Filled weight, so every
 * screen uses one consistent set. They are decorative: the button around each one carries
 * the accessible name.
 */

function filled(Icon: IconComponent, name: string) {
  function FilledIcon({ size = 16, ...props }: IconProps) {
    return (
      <Icon
        weight="Filled"
        size={size}
        aria-hidden
        focusable="false"
        {...props}
      />
    );
  }
  FilledIcon.displayName = name;
  return FilledIcon;
}

/** Points left; rotate it for "expand" on a left panel. */
export const CollapseIcon = filled(AnglesLeft, "CollapseIcon");
export const CloseIcon = filled(Xmark, "CloseIcon");
/** Points down; rotate it half a turn for an open disclosure. */
export const ExpandIcon = filled(AngleDown, "ExpandIcon");
export const CopyIcon = filled(Copy, "CopyIcon");
export const CopiedIcon = filled(Check, "CopiedIcon");
export const EditorIcon = filled(CodeSquare, "EditorIcon");
export const TerminalIcon = filled(TerminalSquare, "TerminalIcon");
export const FinishedIcon = filled(TickCircle, "FinishedIcon");
export const SoundIcon = filled(VolumeHigh, "SoundIcon");
export const LightModeIcon = filled(Sun, "LightModeIcon");
export const DarkModeIcon = filled(Moon, "DarkModeIcon");
export const AlertsIcon = filled(Bell, "AlertsIcon");
export const SettingsIcon = filled(Gear, "SettingsIcon");
export const AppearanceIcon = filled(Palette, "AppearanceIcon");

/* The sidebar's pages, and its collapse button. */
export const NewTaskIcon = filled(AddSquare, "NewTaskIcon");
export const AssistantIcon = filled(ChatRoundCall, "AssistantIcon");
export const ChatRoundedCallIcon = filled(ChatRoundCall, "ChatRoundedCallIcon");
export const OfficeIcon = filled(Buildings, "OfficeIcon");
export const AgentsIcon = filled(People, "AgentsIcon");
export const CustomAgentsIcon = filled(MagicStar, "CustomAgentsIcon");
export const SidebarIcon = filled(SidebarLeft, "SidebarIcon");
export const UsageIcon = filled(ChartSquare, "UsageIcon");
export const CostIcon = filled(DollarCircle, "CostIcon");
export const TokensIcon = filled(Coins, "TokensIcon");
export const SkillIcon = filled(Sparkles, "SkillIcon");
export const ToolIcon = filled(CommandSquare, "ToolIcon");
export const ModelIcon = filled(Data, "ModelIcon");

/* Custom agents: new, delete, a warning about a file, reload from disk. */
export function PlusIcon({ size = 16, ...props }: IconProps): React.JSX.Element {
  return (
    <Plus
      size={size}
      strokeWidth={2.4}
      aria-hidden
      focusable="false"
      {...props}
    />
  );
}
export const TrashIcon = filled(Trash, "TrashIcon");
export const WarningIcon = filled(Warning, "WarningIcon");
export const ReloadIcon = filled(Refresh, "ReloadIcon");
/** The send button's arrow: Reicon's outline arrow, drawn bold to read on a small disc. */
export function ArrowIcon({ size = 16, ...props }: IconProps): React.JSX.Element {
  return (
    <ArrowRight
      size={size}
      strokeWidth={2.4}
      aria-hidden
      focusable="false"
      {...props}
    />
  );
}

/** Back to the office from the settings page; the same bold outline as the send arrow. */
export function BackIcon({ size = 16, ...props }: IconProps): React.JSX.Element {
  return (
    <ArrowLeft
      size={size}
      strokeWidth={2.4}
      aria-hidden
      focusable="false"
      {...props}
    />
  );
}

/** A file attached to a message (not an image). */
export const FileIcon = filled(DocumentText, "FileIcon");

/** A plain paperclip, for attaching files (Reicon's come boxed in a circle or square). */
export function AttachIcon({ size = 16, className, style }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
      focusable="false"
    >
      <path d="M20.5 11.2 12 19.7a5.4 5.4 0 0 1-7.6-7.6l8.8-8.8a3.6 3.6 0 0 1 5.1 5.1l-8.6 8.6a1.8 1.8 0 0 1-2.5-2.5l7.9-7.9" />
    </svg>
  );
}

/** Sends what you typed to the agent. */
export const SendIcon = filled(Send, "SendIcon");
/** A banana shown on, or hidden from, the desktop. */
export const ShowIcon = filled(Eye, "ShowIcon");
export const HideIcon = filled(EyeSlash, "HideIcon");
/** The bananas walking on your desktop. */
export const DesktopWalkersIcon = filled(Monitor, "DesktopWalkersIcon");
/**
 * A plain three-bar burger. Menu's Filled weight puts the bars inside a box, so this uses
 * the Outline bars, thickened to sit with the filled icons.
 */
export function MenuIcon({ size = 16, ...props }: IconProps): React.JSX.Element {
  return (
    <Menu
      size={size}
      strokeWidth={2.4}
      aria-hidden
      focusable="false"
      {...props}
    />
  );
}

/* Tabs: how characters look. */
export const TaskModeIcon = filled(ListCheck, "TaskModeIcon");
export const DeskModeIcon = filled(Desktop, "DeskModeIcon");

/* The two halves of the office. */
export const CampIcon = filled(Bonfire, "CampIcon");
/** Work hours: at work, at lunch, off. */
export const WorkTimeIcon = filled(Briefcase, "WorkTimeIcon");
export const LunchIcon = filled(ForkKnife, "LunchIcon");
export const OffHoursIcon = filled(AlarmSleep, "OffHoursIcon");
export const WorkIcon = filled(LaptopCode, "WorkIcon");

/* Agent details. */
export const AgentIcon = filled(Cpu, "AgentIcon");
export const DeskIcon = filled(Desktop, "DeskIcon");
export const FolderIcon = filled(Folder, "FolderIcon");
export const SessionIcon = filled(Hashtag, "SessionIcon");
export const WaitingIcon = filled(Hourglass, "WaitingIcon");
export const TimerIcon = filled(Timer, "TimerIcon");
export const LastEventIcon = filled(History, "LastEventIcon");
export const ActivityIcon = filled(Pulse, "ActivityIcon");
export const CostumeIcon = filled(Tshirt, "CostumeIcon");

/* One per kind of activity line. */
export const PromptIcon = filled(MessageText, "PromptIcon");
export const ReadIcon = filled(BookOpen, "ReadIcon");
export const SearchIcon = filled(SearchNormal, "SearchIcon");
/** Inside a search box: the filled glass reads as a dot at field size. */
export function SearchFieldIcon({ size = 16, ...props }: IconProps): React.JSX.Element {
  return (
    <SearchNormal
      weight="Outline"
      strokeWidth={2}
      size={size}
      aria-hidden
      focusable="false"
      {...props}
    />
  );
}
export const EditIcon = filled(PenWriting, "EditIcon");
export const PermissionIcon = filled(ShieldAlert, "PermissionIcon");
export const SubagentIcon = filled(Users, "SubagentIcon");
export const StartIcon = filled(PlayCircle, "StartIcon");
export const ContextIcon = filled(Layers, "ContextIcon");
export const SleepIcon = filled(MoonSleep, "SleepIcon");
export const FailedIcon = filled(CloseCircle, "FailedIcon");

export const ACTIVITY_ICON: Readonly<
  Record<ActivityKind, (props: IconProps) => React.JSX.Element>
> = {
  prompt: PromptIcon,
  read: ReadIcon,
  search: SearchIcon,
  terminal: TerminalIcon,
  edit: EditIcon,
  permission: PermissionIcon,
  subagent: SubagentIcon,
  finished: FinishedIcon,
  start: StartIcon,
  context: ContextIcon,
  sleep: SleepIcon,
  failed: FailedIcon,
  other: ActivityIcon,
};

/* One per agent state, shown after its color dot. */
export const IdleIcon = filled(Coffee, "IdleIcon");
export const CalledIcon = filled(Flash, "CalledIcon");
export const NeedsYouIcon = filled(Hand, "NeedsYouIcon");

export const STATE_ICON: Readonly<
  Record<AgentState, (props: IconProps) => React.JSX.Element>
> = {
  idle: IdleIcon,
  called: CalledIcon,
  working: EditIcon,
  reading: ReadIcon,
  running: TerminalIcon,
  "needs-you": NeedsYouIcon,
  done: FinishedIcon,
  stale: SleepIcon,
};
