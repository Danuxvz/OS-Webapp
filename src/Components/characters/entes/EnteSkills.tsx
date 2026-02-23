import type { Ente } from "../../../types"
import { useCallback } from "react"

interface Props {
  ente: Ente
}

function EnteSkills({ ente }: Props) {

  const skills = [
    { key: "AE", value: ente.AE },
    { key: "SB", value: ente.SB },
    { key: "HE", value: ente.HE },
    { key: "AC", value: ente.AC },
  ]

  const handleCopy = useCallback(async (text: string) => {
    if (!text) return
    await navigator.clipboard.writeText(text)
  }, [])

  return (
    <div className="ente-grid">
      {skills.map((skill, index) => {

        const raw = skill.value?.trim() || ""

        let title = ""
        let body = ""

        if (raw) {
          const lines = raw.split(/\r?\n/)
          title = lines[0]
          body = lines.slice(1).join("\n")
        }

        const fullCopyText = raw

        return (
          <div
            key={skill.key}
            className="grid-slot"
            style={{
              opacity: index < (ente.unlockLevel ?? 0) ? 1 : 0.25
            }}
          >
            {raw && (
              <>
                <strong>{title}</strong>
                {body && (
                  <div className="skill-body">
                    {body}
                  </div>
                )}

                <button
                  className="copy-slot-btn"
                  title="Copy text"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopy(fullCopyText)
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default EnteSkills
