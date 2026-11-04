package dev.iris.control.gestures
import org.junit.Assert.*
import org.junit.Test

class GestureEngineTest {
    private val p=Point(.5,.5)
    @Test fun dwellFiresOnceUntilGazeMoves() {
        val e=GestureEngine()
        assertNull(e.update(0,p,.9,false,Mode.CURSOR))
        assertEquals(Action.TAP,e.update(1100,p,.9,false,Mode.CURSOR))
        assertNull(e.update(2500,p,.9,false,Mode.CURSOR))
        e.update(2600,Point(.8,.5),.9,false,Mode.CURSOR)
        assertEquals(Action.TAP,e.update(3700,Point(.8,.5),.9,false,Mode.CURSOR))
    }
    @Test fun confidenceLossCancelsDwell() {
        val e=GestureEngine(); e.update(0,p,.9,false,Mode.CURSOR)
        e.update(900,p,.2,false,Mode.CURSOR)
        assertNull(e.update(1200,p,.9,false,Mode.CURSOR))
    }
    @Test fun naturalBlinkDoesNotClick() {
        val e=GestureEngine(); e.update(0,p,.9,true,Mode.CURSOR)
        assertNull(e.update(90,p,.9,false,Mode.CURSOR))
    }
    @Test fun deliberateDoubleBlink() {
        val e=GestureEngine(); e.update(1000,p,.9,true,Mode.CURSOR); e.update(1250,p,.9,false,Mode.CURSOR)
        e.update(1400,p,.9,true,Mode.CURSOR)
        assertEquals(Action.DOUBLE_TAP,e.update(1650,p,.9,false,Mode.CURSOR))
    }
    @Test fun prolongedOcclusionDoesNotLongPress() {
        val e=GestureEngine(); e.update(0,p,.9,true,Mode.CURSOR)
        assertNull(e.update(5000,p,.9,false,Mode.CURSOR))
    }
}
