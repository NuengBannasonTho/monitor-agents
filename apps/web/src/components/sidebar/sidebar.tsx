import { zoneOf } from "@agent-office/shared";
import type { Agent } from "@agent-office/shared";
import { Tooltip } from "@animate-ui/react/primitives/radix-ui/tooltip";
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import type { IconProps } from "reicon-react/createIcon";
import { APP_WORDMARK } from "../../lib/brand";
import type { Page } from "../../lib/route";
import { navigate, useRoute } from "../../lib/route";
import { useMediaQuery } from "../../hooks/use-media-query";
import {
  AgentsIcon,
  ChatRoundedCallIcon,
  CampIcon,
  CustomAgentsIcon,
  FinishedIcon,
  NeedsYouIcon,
  NewTaskIcon,
  OfficeIcon,
  SettingsIcon,
  SidebarIcon,
  UsageIcon,
  WorkIcon,
} from "../icons";
import type { Source } from "./account-card";
import { AccountCard } from "./account-card";
import { MonLogo } from "./mon-logo";
import styles from "./sidebar.module.css";

interface SidebarProps {
  readonly agents: readonly Agent[];
  /** Agents waiting on you, longest wait first. */
  readonly waiting: readonly Agent[];
  /** Finished turns you have not opened yet, oldest first. */
  readonly finished: readonly Agent[];
  /** Opens an agent's details. */
  readonly onOpen: (id: string) => void;
  readonly source: Source;
}

const COLLAPSED_KEY = "agent-office:sidebar-collapsed:v1";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Collapsed to icons or open with labels; remembered in this browser. */
function useCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = useCallback(() => {
    setCollapsed((was) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, was ? "0" : "1");
      } catch {
        // Storage blocked: the choice lasts until reload.
      }
      return !was;
    });
  }, []);
  return [collapsed, toggle];
}

interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly Icon: (props: IconProps) => React.JSX.Element;
  readonly page: Page;
  /** The Agents page's filter, for the Focus items. */
  readonly section?: string;
  readonly count?: number;
  /** The count in red: someone is waiting. */
  readonly urgent?: boolean;
}

interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
}

/**
 * The app's frame on the left, edge to edge: brand and the collapse button, the pages in
 * groups, what needs you, and the connection. Collapses to a rail of icons (always, on a
 * narrow screen).
 */
export function Sidebar({
  agents,
  waiting,
  finished,
  onOpen,
  source,
}: SidebarProps): React.JSX.Element {
  const route = useRoute();
  const [collapsedChoice, handleToggleCollapsed] = useCollapsed();
  const narrow = useMediaQuery("(max-width: 760px)");
  const collapsed = collapsedChoice || narrow;

  const working = agents.filter(
    (a) => zoneOf(a.state) === "table" && a.state !== "needs-you",
  );
  const resting = agents.filter((a) => zoneOf(a.state) === "lounge");
  const groups: readonly NavGroup[] = [
    {
      title: "Work",
      items: [
        {
          id: "assistant",
          label: "Assistant",
          Icon: ChatRoundedCallIcon,
          page: "assistant",
        },
        {
          id: "new-task",
          label: "New task",
          Icon: NewTaskIcon,
          page: "new-task",
        },
        { id: "office", label: "Office", Icon: OfficeIcon, page: "office" },
        {
          id: "agents",
          label: "Agents",
          Icon: AgentsIcon,
          page: "agents",
          count: agents.length,
        },
        { id: "usage", label: "Usage", Icon: UsageIcon, page: "usage" },
      ],
    },
    {
      title: "Focus",
      items: [
        {
          id: "needs-you",
          label: "Needs you",
          Icon: NeedsYouIcon,
          page: "agents",
          section: "needs-you",
          count: waiting.length,
          urgent: waiting.length > 0,
        },
        {
          id: "working",
          label: "Working",
          Icon: WorkIcon,
          page: "agents",
          section: "working",
          count: working.length,
        },
        {
          id: "resting",
          label: "Resting",
          Icon: CampIcon,
          page: "agents",
          section: "resting",
          count: resting.length,
        },
      ],
    },
    {
      title: "Setup",
      items: [
        {
          id: "custom-agents",
          label: "Custom agents",
          Icon: CustomAgentsIcon,
          page: "custom-agents",
        },
        {
          id: "settings",
          label: "Settings",
          Icon: SettingsIcon,
          page: "settings",
        },
      ],
    },
  ];

  const isActive = (item: NavItem): boolean => {
    if (route.page !== item.page) return false;
    // Agents itself is "all"; its Focus items are its filters. Settings keeps its section.
    if (item.page !== "agents") return true;
    const filter =
      route.section === null || route.section === "all"
        ? undefined
        : route.section;
    return filter === item.section;
  };

  return (
    <aside className={styles.sidebar} data-collapsed={collapsed}>
      <div className={styles.brand}>
        {collapsed && !narrow ? (
          <Hint label="Expand sidebar" enabled>
            <button
              type="button"
              className={styles.logoButton}
              onClick={handleToggleCollapsed}
              aria-expanded={false}
              aria-label="Expand sidebar"
            >
              <span className={styles.logoArt}>
                <MonLogo />
              </span>
              <span className={styles.logoToggle}>
                <SidebarIcon size={18} />
              </span>
            </button>
          </Hint>
        ) : (
          <span className={styles.logo}>
            <MonLogo />
          </span>
        )}
        <span className={styles.title}>
          <span className={styles.titleMain}>{APP_WORDMARK.main}</span>{" "}
        </span>
        {!collapsed && (
          <Hint label="Collapse sidebar" enabled>
            <button
              type="button"
              className={styles.toggle}
              onClick={handleToggleCollapsed}
              aria-expanded
              aria-label="Collapse sidebar"
            >
              <SidebarIcon size={18} />
            </button>
          </Hint>
        )}
      </div>

      <nav className={styles.nav} aria-label="Pages">
        {groups.map((group) => (
          <div key={group.title} className={styles.group}>
            <p className={styles.groupTitle}>{group.title}</p>
            {group.items.map((item) => {
              const active = isActive(item);
              const { Icon } = item;
              return (
                <Hint key={item.id} label={item.label} enabled={collapsed}>
                  <button
                    type="button"
                    className={styles.item}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    onClick={() => {
                      if (!active) navigate(item.page, item.section ?? null);
                    }}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className={styles.active}
                        transition={{
                          type: "spring",
                          stiffness: 520,
                          damping: 42,
                        }}
                      />
                    )}
                    <Icon size={20} className={styles.itemIcon} />
                    <span className={styles.label}>{item.label}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <span
                        className={styles.count}
                        data-urgent={item.urgent === true || undefined}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                </Hint>
              );
            })}
          </div>
        ))}
      </nav>

      <p className="visually-hidden" aria-live="polite">
        {waiting.length === 0
          ? "No agents need you"
          : `${String(waiting.length)} agent${waiting.length === 1 ? "" : "s"} need you`}
      </p>

      <div className={styles.foot}>
        {finished[0] !== undefined && (
          <Hint
            label={`${finished.length === 1 ? `${finished[0].desk} finished` : `${String(finished.length)} finished`}: open`}
            enabled={collapsed}
          >
            <button
              type="button"
              className={styles.finished}
              onClick={() => {
                if (finished[0] !== undefined) onOpen(finished[0].id);
              }}
              title={
                collapsed
                  ? undefined
                  : `Finished, not opened yet: ${finished.map((a) => a.desk).join(", ")}`
              }
            >
              <FinishedIcon size={18} className={styles.check} />
              <span className={styles.label}>
                {finished.length === 1
                  ? `${finished[0].desk} finished`
                  : `${String(finished.length)} finished`}
              </span>
              {collapsed && finished.length > 1 && (
                <span className={styles.finishedCount}>{finished.length}</span>
              )}
            </button>
          </Hint>
        )}
        <AccountCard source={source} collapsed={collapsed} />
      </div>
    </aside>
  );
}

/** A label beside an icon-only control; only while the sidebar is collapsed. */
function Hint({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: React.JSX.Element;
}) {
  if (!enabled) return children;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={styles.hint} side="right" sideOffset={10}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
