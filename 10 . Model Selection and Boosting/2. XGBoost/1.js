async updateStateFromPrevState() {
  this.cleanUpButtons();
  console.log(
    'updateStateFromPrevState called, state:',
    this.questionState,
    'phase:',
    this.phase
  );

  if (this.questionState === 'INPROGRESS' && this.phase === 'select') {
    // This question is in-progress and the user left during the "select" phase.
    // Handle resumption based on selection progress:
    // - If full selection: auto-check win condition.
    // - If none (just after Ready): revert to memorize view (re-show tiles for study).
    // - If partial (some but not all): preserve partial select (tiles hidden, selections shown).
    isGameOver = false;
    this.locked = false;

    if (
      this.selectedTiles &&
      this.selectedTiles.length === this.requiredFlips
    ) {
      // Full selection: proceed with check
      this.checkWinCondition();
      return;
    }

    if (this.selectedTiles && this.selectedTiles.length === 0) {
      // Zero selection (post-Ready): revert to memorize so tiles are visible again.
      // This covers cases where they clicked Ready but left/opened modal before selecting any.
      this.phase = 'memorize';

      // Reset tile visuals so the front (value? Wait no: to show numbers (back)
      if (Array.isArray(this.tiles)) {
        this.tiles.forEach((tile) => {
          try {
            // Mark as not-revealed initially
            tile.revealed = false;

            // Show front? No: for memorize, we want back (numbers) visible
            // But code sets front visible, back hidden, THEN flipVisual(true) to back
            if (tile.front && typeof tile.front.setVisible === 'function') {
              tile.front.setVisible(true);
            }
            if (tile.back && typeof tile.back.setVisible === 'function') {
              tile.back.setVisible(false);
            }

            // Restore interactivity during memorize
            if (typeof tile.setInteractive === 'function') {
              tile.setInteractive({ useHandCursor: true });
            }
          } catch (e) {
            // Defensive
          }
        });

        // Animate reveal for memorize: flip to show back (numbers)
        this.tiles.forEach((tile) => {
          try {
            this.flipVisual(tile, true, () => {
              tile.revealed = true;
            });
          } catch (e) {
            // Fallback: show back
            if (tile.back) tile.back.setVisible(true);
            if (tile.front) tile.front.setVisible(false);
          }
        });
      }

      // Clear any partial selections (reset for re-memorize)
      this.selectedTiles = [];
      this.selectedSum = 0;
      if (this.flipTexts) this.flipTexts.forEach((t) => t.setText(''));
      if (this.flipBoxes) {
        this.flipBoxes.forEach((b) => {
          b.graphics.clear();
          b.graphics.fillStyle(0x0a2253, 1);
          b.graphics.fillRoundedRect(-49, -49, 98, 98, 20);
          b.graphics.lineStyle(4, 0x18ffff, 1);
          b.graphics.strokeRoundedRect(-50, -50, 100, 100, 20);
        });
      }
      if (this.sumText) this.sumText.setText('');
      if (this.sumBox) this.sumBox.setTexture('sumBox1');

      // Recreate Ready button
      if (this.readyBtn) {
        try {
          this.readyBtn.destroy();
        } catch (e) {}
        this.readyBtn = null;
      }
      if (typeof this.createReadyButton === 'function') {
        this.createReadyButton();
      }

      // Persist revert
      try {
        if (typeof this.saveCurrentGameState === 'function') {
          this.saveCurrentGameState();
        }
      } catch (e) {
        console.warn('Save after revert failed');
      }

      return;
    }

    // Partial selection (1+ but < required): preserve as-is (phase 'select', selections shown, tiles hidden except selected)
    console.log('Resuming partial select state');
    return;
  }

  if (this.questionState === 'ACCEPTED') {
    // UPDATED: First restore selected UI from saved data, then draw correct state + buttons
    console.log('Restoring ACCEPTED state with selected UI');
    // Restore revealed tiles
    this.tiles.forEach((tile, idx) => {
      tile.revealed = this.revealedIndices.includes(idx);
      if (!tile.revealed) {
        tile.front.setVisible(true).setScale(1, 1);
        tile.back.setVisible(false);
      } else {
        tile.front.setVisible(false);
        tile.back.setVisible(true).setScale(1, 1);
      }
    });
    // Restore selected tiles/flip boxes/sum (same as INPROGRESS)
    this.selectedTiles = [];
    this.selectedSum = 0;
    this.flipTexts.forEach((t) => t.setText(''));
    this.flipBoxes.forEach((b) => {
      b.graphics.clear();
      b.graphics.fillStyle(0x0a2253, 1);
      b.graphics.fillRoundedRect(-49, -49, 98, 98, 20);
      b.graphics.lineStyle(4, 0x18ffff, 1);
      b.graphics.strokeRoundedRect(-50, -50, 100, 100, 20);
    });
    this.sumText.setText('');
    this.sumBox.setTexture('sumBox1');
    this.selectedIndices.forEach((idx, sidx) => {
      const tile = this.tiles[idx];
      if (tile) {
        tile.revealed = true;
        this.selectedTiles.push(tile);
        this.selectedSum += tile.number;
        const index = sidx;
        this.flipTexts[index].setText(tile.number);
        let box = this.flipBoxes[index];
        box.graphics.clear();
        box.graphics.fillStyle(0x5ef2f9, 1);
        box.graphics.fillRoundedRect(-50, -50, 100, 100, 13);
        box.graphics.lineStyle(4, 0xbffdfd, 1);
        box.graphics.strokeRoundedRect(-50, -50, 100, 100, 13);
      }
    });
    // UPDATED: Set sumText only if >0 (blank for empty, though unlikely for completed)
    this.sumText.setText(
      this.selectedSum > 0 ? this.selectedSum.toString() : ''
    );
    if (this.selectedSum > 0) {
      this.sumBox.setTexture('sumBox2');
    }
    if (this.selectedTiles.length > 0) {
      this.selectedGraphics.clear();
      this.selectedGraphics.lineStyle(6, 0xe040fb, 1);
      this.selectedGraphics.strokeRoundedRect(
        this.rectX,
        this.rectY,
        this.rectWidth2,
        this.rectHeight2,
        18
      );
      this.selectedGraphics.fillStyle(0x000232, 1);
      this.selectedGraphics.fillRoundedRect(
        this.rectX,
        this.rectY,
        this.rectWidth2,
        this.rectHeight2,
        18
      );
    }
    // Now draw correct visuals
    this.drawCorrectState();
    isGameOver = true;
    this.locked = true;
    this.tiles.forEach((tile) => tile.disableInteractive());
    this.createButtonsForCompleted(true);
    // Save restored state
    this.saveCurrentGameState();
    return;
  }
  if (this.questionState === 'UNACCEPTED') {
    // UPDATED: First restore selected UI from saved data, then draw wrong state + buttons
    console.log('Restoring UNAccepted state with selected UI');
    // Restore revealed tiles
    this.tiles.forEach((tile, idx) => {
      tile.revealed = this.revealedIndices.includes(idx);
      if (!tile.revealed) {
        tile.front.setVisible(true).setScale(1, 1);
        tile.back.setVisible(false);
      } else {
        tile.front.setVisible(false);
        tile.back.setVisible(true).setScale(1, 1);
      }
    });
    // Restore selected tiles/flip boxes/sum (same as INPROGRESS)
    this.selectedTiles = [];
    this.selectedSum = 0;
    this.flipTexts.forEach((t) => t.setText(''));
    this.flipBoxes.forEach((b) => {
      b.graphics.clear();
      b.graphics.fillStyle(0x0a2253, 1);
      b.graphics.fillRoundedRect(-49, -49, 98, 98, 20);
      b.graphics.lineStyle(4, 0x18ffff, 1);
      b.graphics.strokeRoundedRect(-50, -50, 100, 100, 20);
    });
    this.sumText.setText('');
    this.sumBox.setTexture('sumBox1');
    this.selectedIndices.forEach((idx, sidx) => {
      const tile = this.tiles[idx];
      if (tile) {
        tile.revealed = true;
        this.selectedTiles.push(tile);
        this.selectedSum += tile.number;
        const index = sidx;
        this.flipTexts[index].setText(tile.number);
        let box = this.flipBoxes[index];
        box.graphics.clear();
        box.graphics.fillStyle(0x5ef2f9, 1);
        box.graphics.fillRoundedRect(-50, -50, 100, 100, 13);
        box.graphics.lineStyle(4, 0xbffdfd, 1);
        box.graphics.strokeRoundedRect(-50, -50, 100, 100, 13);
      }
    });
    // UPDATED: Set sumText only if >0 (blank for empty, though unlikely for completed)
    this.sumText.setText(
      this.selectedSum > 0 ? this.selectedSum.toString() : ''
    );
    if (this.selectedSum > 0) {
      this.sumBox.setTexture('sumBox2');
    }
    if (this.selectedTiles.length > 0) {
      this.selectedGraphics.clear();
      this.selectedGraphics.lineStyle(6, 0xe040fb, 1);
      this.selectedGraphics.strokeRoundedRect(
        this.rectX,
        this.rectY,
        this.rectWidth2,
        this.rectHeight2,
        18
      );
      this.selectedGraphics.fillStyle(0x000232, 1);
      this.selectedGraphics.fillRoundedRect(
        this.rectX,
        this.rectY,
        this.rectWidth2,
        this.rectHeight2,
        18
      );
    }
    // Now draw wrong visuals
    this.drawWrongState();
    if (
      this.selectedSum === this.targetNumber &&
      this.selectedTiles.length < this.requiredFlips
    ) {
      this.feedbackText = this.add.text(
        410,
        810,
        'Flip at least three cards to complete the addition.',
        {
          fontFamily: 'Basis Grotesque Pro-Bold',
          fontSize: '51px',
          color: '#FFFFFF',
          textAlign: 'center',
        }
      );
    }
    isGameOver = true;
    this.locked = true;
    this.tiles.forEach((tile) => tile.disableInteractive());
    this.createButtonsForCompleted(false);
    // Save restored state
    this.saveCurrentGameState();
    return;
  }
  if (this.phase === 'memorize' && !this.readyBtn) {
    this.createReadyButton();
  }
  this.applyAccessibiltySettings();
}