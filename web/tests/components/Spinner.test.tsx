import { describe, it, expect } from 'vitest';
import { render } from '../utils';
import { Spinner } from '@/components/Spinner';

describe('Spinner', () => {
  it('renders without crashing', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with different sizes', () => {
    const { container: sm } = render(<Spinner size="sm" />);
    const { container: lg } = render(<Spinner size="lg" />);

    const smSvg = sm.querySelector('svg')!;
    const lgSvg = lg.querySelector('svg')!;

    expect(smSvg.classList.toString()).toContain('h-4');
    expect(lgSvg.classList.toString()).toContain('h-12');
  });
});
