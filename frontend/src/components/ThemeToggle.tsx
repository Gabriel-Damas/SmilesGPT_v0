import React from "react"
import styled from "styled-components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faSun, faMoon, faDesktop } from "@fortawesome/free-solid-svg-icons"
import { useTheme, type Theme } from "../hooks/useTheme"

interface ThemeToggleProps {
  showSystemOption?: boolean
  className?: string
}

const Button = styled.button`
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease,
    transform 0.08s ease;

  &:hover {
    background: var(--bg-sunken);
    color: var(--text-primary);
  }

  &:active {
    transform: translateY(1px);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--bg-surface), 0 0 0 4px var(--accent-current);
  }
`

const IconStack = styled.div`
  position: relative;
  width: 18px;
  height: 18px;
  margin: 0 auto;
`

const Icon = styled.div<{ $visible: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease, transform 0.2s ease;
  opacity: ${p => (p.$visible ? 1 : 0)};
  transform: ${p =>
    p.$visible ? "rotate(0deg) scale(1)" : "rotate(-8deg) scale(0.9)"};
`

const Segmented = styled.div`
  display: flex;
  gap: 1px;
  padding: 1px;
  border-radius: 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
`

const SegItem = styled.button<{ $active: boolean }>`
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  background: ${p => (p.$active ? "var(--bg-surface)" : "transparent")};
  color: ${p => (p.$active ? "var(--accent-current)" : "var(--text-muted)")};
  transition: background 0.2s ease, color 0.2s ease;

  &:hover {
    background: ${p =>
      p.$active ? "var(--bg-surface)" : "var(--bg-sunken)"};
  }
`

export function ThemeToggle({
  showSystemOption = false,
  className
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleLightDark } = useTheme()

  if (showSystemOption) {
    return (
      <Segmented className={className} data-testid="theme-toggle">
        {(["light", "system", "dark"] as Theme[]).map(option => (
          <SegItem
            key={option}
            type="button"
            $active={theme === option}
            onClick={() => setTheme(option)}
            aria-label={`Definir tema para ${option}`}
          >
            {option === "light" && (
              <FontAwesomeIcon icon={faSun} size="sm" />
            )}

            {option === "system" && (
              <FontAwesomeIcon icon={faDesktop} size="sm" />
            )}

            {option === "dark" && (
              <FontAwesomeIcon icon={faMoon} size="sm" />
            )}
          </SegItem>
        ))}
      </Segmented>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      onClick={toggleLightDark}
      className={className}
      aria-label="Alternar tema"
    >
      <IconStack>
        <Icon $visible={!isDark}>
          <FontAwesomeIcon icon={faSun} size="sm" />
        </Icon>

        <Icon $visible={isDark}>
          <FontAwesomeIcon icon={faMoon} size="sm" />
        </Icon>
      </IconStack>
    </Button>
  )
}