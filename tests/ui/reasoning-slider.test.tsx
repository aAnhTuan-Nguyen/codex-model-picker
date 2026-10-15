// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { ReasoningSlider } from '../../src/renderer/picker/ReasoningSlider'
afterEach(cleanup)
const model = { id: 'a', displayName: 'A', efforts: ['low', 'medium', 'high'], defaultEffort: 'medium', source: 'cli' as const }
it('supports keyboard changes with accessible discrete values', () => {
  const change = vi.fn()
  render(<ReasoningSlider model={model} effort={{ kind: 'set', value: 'medium' }} onChange={change} />)
  const slider = screen.getByRole('slider', { name: 'Mức suy luận' })
  expect(slider).toHaveAttribute('aria-valuetext', 'Medium')
  fireEvent.keyDown(slider, { key: 'End' })
  expect(change).toHaveBeenLastCalledWith({ kind: 'set', value: 'high' })
})
it('does not invent a slider when capabilities are unknown or singular', () => {
  const { rerender } = render(<ReasoningSlider model={{ ...model, efforts: null }} effort={{ kind: 'keep' }} onChange={vi.fn()} />)
  expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  rerender(<ReasoningSlider model={{ ...model, efforts: ['high'] }} effort={{ kind: 'set', value: 'high' }} onChange={vi.fn()} />)
  expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'High' })).toBeInTheDocument()
})
