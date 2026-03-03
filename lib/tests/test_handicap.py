"""Tests for handicap module."""

import pytest
from nyig_td.ranks import Rank
from nyig_td.handicap import Handicap, HandicapCalculator


class TestHandicapCalculator:
    """Test HandicapCalculator."""

    def setup_method(self):
        self.calc = HandicapCalculator()

    def test_even_game(self):
        white = Rank.from_string("3d")
        black = Rank.from_string("3d")
        hc = self.calc.calculate(white, black)
        assert hc.stones == 0
        assert hc.komi == 7.5

    def test_one_stone_difference(self):
        white = Rank.from_string("3d")
        black = Rank.from_string("2d")
        hc = self.calc.calculate(white, black)
        assert hc.stones == 0
        assert hc.komi == 0.5

    def test_two_stone_difference(self):
        white = Rank.from_string("3d")
        black = Rank.from_string("1d")
        hc = self.calc.calculate(white, black)
        assert hc.stones == 2
        assert hc.komi == 0.5

    def test_large_difference_capped(self):
        white = Rank.from_string("5d")
        black = Rank.from_string("10k")
        hc = self.calc.calculate(white, black)
        assert hc.stones == 9  # Capped at 9

    def test_weaker_white(self):
        white = Rank.from_string("5k")
        black = Rank.from_string("3d")
        hc = self.calc.calculate(white, black)
        assert hc.stones == 0
        assert hc.komi == 7.5  # Even game

    def test_reduction(self):
        calc = HandicapCalculator(reduction=1)
        white = Rank.from_string("4d")
        black = Rank.from_string("1k")
        hc = calc.calculate(white, black)
        # 4 stone diff - 1 reduction = 3 stones
        assert hc.stones == 3

    def test_reduction_to_even(self):
        """Test reduction that results in even game."""
        calc = HandicapCalculator(reduction=2)
        white = Rank.from_string("3d")
        black = Rank.from_string("1d")
        hc = calc.calculate(white, black)
        # 2 stone diff - 2 reduction = 0 -> even game
        assert hc.stones == 0
        assert hc.komi == 7.5

    def test_calculate_from_strings(self):
        """Test convenience method for string ranks."""
        calc = HandicapCalculator()
        hc = calc.calculate_from_strings("3d", "1k")
        # 3d - 1k = 3 stones difference
        assert hc.stones == 3
        assert hc.komi == 0.5

    def test_handicap_str_even(self):
        """Test Handicap string for even game."""
        hc = Handicap(stones=0, komi=7.5)
        assert str(hc) == "Even game, komi 7.5"

    def test_handicap_str_with_stones(self):
        """Test Handicap string with stones."""
        hc = Handicap(stones=4, komi=0.5)
        assert str(hc) == "4 stones, komi 0.5"


class TestSuggestColors:
    """Test suggest_colors helper function."""

    def test_stronger_player_first(self):
        """Test that stronger player is suggested as white."""
        from nyig_td.handicap import suggest_colors

        strong = Rank.from_string("5d")
        weak = Rank.from_string("3k")

        white, black = suggest_colors(strong, weak)
        assert white == strong
        assert black == weak

    def test_weaker_player_first(self):
        """Test when weaker player is passed first."""
        from nyig_td.handicap import suggest_colors

        strong = Rank.from_string("5d")
        weak = Rank.from_string("3k")

        white, black = suggest_colors(weak, strong)
        assert white == strong
        assert black == weak

    def test_equal_ranks(self):
        """Test with equal ranks."""
        from nyig_td.handicap import suggest_colors

        r1 = Rank.from_string("3d")
        r2 = Rank.from_string("3d")

        white, black = suggest_colors(r1, r2)
        # First argument should be white when equal
        assert white == r1
        assert black == r2
