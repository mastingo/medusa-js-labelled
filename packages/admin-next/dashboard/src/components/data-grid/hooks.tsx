import { CellContext } from "@tanstack/react-table"
import React, {
  MouseEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { DataGridContext } from "./context"
import { GridQueryTool } from "./models"
import {
  CellCoords,
  DataGridCellContext,
  DataGridCellRenderProps,
} from "./types"
import { generateCellId, isCellMatch } from "./utils"

const useDataGridContext = () => {
  const context = useContext(DataGridContext)

  if (!context) {
    throw new Error(
      "useDataGridContext must be used within a DataGridContextProvider"
    )
  }

  return context
}

type UseDataGridCellProps<TData, TValue> = {
  field: string
  context: CellContext<TData, TValue>
  type: "text" | "number" | "select" | "boolean"
}

const textCharacterRegex = /^.$/u
const numberCharacterRegex = /^[0-9]$/u

export const useDataGridCell = <TData, TValue>({
  field,
  context,
  type,
}: UseDataGridCellProps<TData, TValue>) => {
  const { rowIndex, columnIndex } = context as DataGridCellContext<
    TData,
    TValue
  >

  const coords: CellCoords = useMemo(
    () => ({ row: rowIndex, col: columnIndex }),
    [rowIndex, columnIndex]
  )
  const id = generateCellId(coords)

  const {
    register,
    control,
    anchor,
    setIsEditing,
    setSingleRange,
    setIsSelecting,
    setRangeEnd,
    getWrapperFocusHandler,
    getWrapperMouseOverHandler,
    getInputChangeHandler,
    getIsCellSelected,
    getIsCellDragSelected,
    registerCell,
  } = useDataGridContext()

  useEffect(() => {
    registerCell(coords, field, type)
  }, [coords, field, type, registerCell])

  const [showOverlay, setShowOverlay] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLElement>(null)

  const handleOverlayMouseDown = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.detail === 2) {
        if (inputRef.current) {
          setShowOverlay(false)

          inputRef.current.focus()

          return
        }
      }

      if (e.shiftKey) {
        // Only allow setting the rangeEnd if the column matches the anchor column.
        // If not we let the function continue and treat the click as if the shift key was not pressed.
        if (coords.col === anchor?.col) {
          setRangeEnd(coords)
          return
        }
      }

      if (containerRef.current) {
        setSingleRange(coords)
        setIsSelecting(true)
        containerRef.current.focus()
      }
    },
    [coords, anchor, setRangeEnd, setSingleRange, setIsSelecting]
  )

  const handleBooleanInnerMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.detail === 2) {
        inputRef.current?.focus()
        return
      }

      if (e.shiftKey) {
        setRangeEnd(coords)
        return
      }

      if (containerRef.current) {
        setSingleRange(coords)
        setIsSelecting(true)
        containerRef.current.focus()
      }
    },
    [setIsSelecting, setSingleRange, setRangeEnd, coords]
  )

  const handleInputBlur = useCallback(() => {
    setShowOverlay(true)
    setIsEditing(false)
  }, [setIsEditing])

  const handleInputFocus = useCallback(() => {
    setShowOverlay(false)
    setIsEditing(true)
  }, [setIsEditing])

  const validateKeyStroke = useCallback(
    (key: string) => {
      if (type === "number") {
        return numberCharacterRegex.test(key)
      }

      if (type === "text") {
        return textCharacterRegex.test(key)
      }

      // KeyboardEvents should not be forwareded to other types of cells
      return false
    },
    [type]
  )

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!inputRef.current || !validateKeyStroke(e.key) || !showOverlay) {
        return
      }

      // Allow the user to undo/redo
      if (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey)) {
        return
      }

      // Allow the user to copy
      if (e.key.toLowerCase() === "c" && (e.ctrlKey || e.metaKey)) {
        return
      }

      // Allow the user to paste
      if (e.key.toLowerCase() === "v" && (e.ctrlKey || e.metaKey)) {
        return
      }

      const event = new KeyboardEvent(e.type, e.nativeEvent)

      inputRef.current.focus()
      setShowOverlay(false)

      // if the inputRef can use .select() then we can use it here
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }

      inputRef.current.dispatchEvent(event)
    },
    [showOverlay, validateKeyStroke]
  )

  const isAnchor = useMemo(() => {
    return anchor ? isCellMatch(coords, anchor) : false
  }, [anchor, coords])

  const fieldWithoutOverlay = useMemo(() => {
    return type === "boolean" || type === "select"
  }, [type])

  useEffect(() => {
    if (isAnchor && !containerRef.current?.contains(document.activeElement)) {
      containerRef.current?.focus()
    }
  }, [isAnchor])

  const renderProps: DataGridCellRenderProps = {
    container: {
      isAnchor,
      isSelected: getIsCellSelected(coords),
      isDragSelected: getIsCellDragSelected(coords),
      showOverlay: fieldWithoutOverlay ? false : showOverlay,
      innerProps: {
        ref: containerRef,
        onMouseOver: getWrapperMouseOverHandler(coords),
        onMouseDown:
          type === "boolean" ? handleBooleanInnerMouseDown : undefined,
        onKeyDown: handleContainerKeyDown,
        onFocus: getWrapperFocusHandler(coords),
        "data-container-id": id,
      },
      overlayProps: {
        onMouseDown: handleOverlayMouseDown,
      },
    },
    input: {
      ref: inputRef,
      onBlur: handleInputBlur,
      onFocus: handleInputFocus,
      onChange: getInputChangeHandler(field),
      "data-row": coords.row,
      "data-col": coords.col,
      "data-cell-id": id,
      "data-field": field,
    },
  }

  return {
    id,
    register,
    control,
    renderProps,
  }
}

export const useGridQueryTool = (
  containerRef: React.RefObject<HTMLElement>
) => {
  const queryToolRef = useRef<GridQueryTool | null>(null)

  useEffect(() => {
    if (containerRef.current) {
      queryToolRef.current = new GridQueryTool(containerRef.current)
    }
  }, [containerRef])

  return queryToolRef.current
}
