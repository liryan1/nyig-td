"""Tests for rank module."""

import pytest
from nyig_td.ranks import Rank, RankType, validate_rank


class TestRank:
    """Test Rank class."""

    def test_from_string_kyu(self):
        rank = Rank.from_string("5k")
        assert rank.rank_type == RankType.KYU
        assert rank.level == 5
        assert str(rank) == "5k"

    def test_from_string_dan(self):
        rank = Rank.from_string("3d")
        assert rank.rank_type == RankType.DAN
        assert rank.level == 3
        assert str(rank) == "3d"

    def test_from_string_case_insensitive(self):
        assert Rank.from_string("5K") == Rank.from_string("5k")
        assert Rank.from_string("3D") == Rank.from_string("3d")

    def test_from_string_invalid(self):
        with pytest.raises(ValueError):
            Rank.from_string("5x")
        with pytest.raises(ValueError):
            Rank.from_string("abc")
        with pytest.raises(ValueError):
            Rank.from_string("0k")
        with pytest.raises(ValueError):
            Rank.from_string("31k")
        with pytest.raises(ValueError):
            Rank.from_string("10d")

    def test_ordering(self):
        assert Rank.from_string("1d") > Rank.from_string("1k")
        assert Rank.from_string("3d") > Rank.from_string("1d")
        assert Rank.from_string("1k") > Rank.from_string("5k")
        assert Rank.from_string("5k") > Rank.from_string("10k")

    def test_difference(self):
        r3d = Rank.from_string("3d")
        r5k = Rank.from_string("5k")
        assert r3d.difference(r5k) == 7
        assert r5k.difference(r3d) == -7

    def test_stones_difference(self):
        r3d = Rank.from_string("3d")
        r5k = Rank.from_string("5k")
        assert r3d.stones_difference(r5k) == 7
        assert r5k.stones_difference(r3d) == 7


class TestRankFactoryMethods:
    """Test Rank factory methods."""

    def test_from_kyu_valid(self):
        rank = Rank.from_kyu(5)
        assert rank.rank_type == RankType.KYU
        assert rank.level == 5
        assert str(rank) == "5k"

    def test_from_kyu_edge_cases(self):
        # Test boundaries
        rank_1k = Rank.from_kyu(1)
        rank_30k = Rank.from_kyu(30)
        assert str(rank_1k) == "1k"
        assert str(rank_30k) == "30k"

    def test_from_kyu_invalid(self):
        with pytest.raises(ValueError):
            Rank.from_kyu(0)  # Too low
        with pytest.raises(ValueError):
            Rank.from_kyu(31)  # Too high

    def test_from_dan_valid(self):
        rank = Rank.from_dan(5)
        assert rank.rank_type == RankType.DAN
        assert rank.level == 5
        assert str(rank) == "5d"

    def test_from_dan_invalid(self):
        with pytest.raises(ValueError):
            Rank.from_dan(0)  # Too low
        with pytest.raises(ValueError):
            Rank.from_dan(10)  # Too high

    def test_repr(self):
        rank = Rank.from_string("3d")
        assert repr(rank) == "Rank('3d')"

        kyu_rank = Rank.from_string("5k")
        assert repr(kyu_rank) == "Rank('5k')"


class TestValidateRank:
    """Test validate_rank function."""

    def test_valid_ranks(self):
        assert validate_rank("5k") is True
        assert validate_rank("3d") is True
        assert validate_rank("30k") is True
        assert validate_rank("9d") is True

    def test_invalid_ranks(self):
        assert validate_rank("5x") is False
        assert validate_rank("0k") is False
        assert validate_rank("31k") is False
