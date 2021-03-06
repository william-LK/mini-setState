# mini-setState
a mini setState of React
## 前言
setState 有一个“怪异”的现象，就是调用该方法修改state时，有时候看起来同步执行，有时候看起来是异步执行，这也是面试常问的一个点。为什么会出现这种情况呢？今天我就来为大家讲解一下并尝试做一个简单的 demo 来让大家对 setState 的机制有进一步的理解。mini-setState 的代码仓库：[源代码飞机票](https://github.com/william-LK/mini-setState)，大家可以先拉下来，一边看文章一边调试。

### 前置知识
在学习前首先要知道几个的知识点:
* Javascript 的 Event-loop 机制，也就是事件循环.
* React 的事件机制.

## 怪异现象
首先，我们先看看上面所说的怪异情况是什么？
```js
class App extends React.Component{
    constructor(props){
        super(props);
        this.btnClick = this.btnCLick.bind(this);
    }
    state = {
        a: 1
    }
    btnClick(){
        this.setState({
            a: this.state.a + 1
        });
        this.setState({
            a: this.state.a + 1
        });
        console.log('点击时的a的值为：',this.state.a);
    }
    render(){
        return (
            <>
                <div>hello william</div>
                <button onClick={this.btnClick}>点击按钮</button>
            </>
        )
    }
}
```
控制台的打印记录显示: **点击时的a的值为：1** 。从这个角度看调用 setState ,貌似是异步的，但是我们再看下面一个例子
```js
class App extends React.Component{
    constructor(props){
        super(props);
        this.btnClick = this.btnCLick.bind(this);
    }
    state = {
        a: 1
    }
    btnClick(){
        setTimeout(() => {
            this.setState({
                a: this.state.a + 1
            })
            console.log('点击时的a的值',this.state.a);
        },0)
    }
    render(){
        return (
            <>
                <div>hello william</div>
                <button onClick={this.btnClick}>点击按钮</button>
            </>
        )
    }
}
```
控制台的打印记录显示: **点击时的a的值为：2**。从这里看又是同步的，究竟中间发生了什么？下面会为大家展示个中的奥秘，请耐心观看哈。

## 原因
首先，我们要明白这个类异步操作不是 React 的 Bug，而是有意而为之的。在 React 里面称之为批量更新。为什么这么说？大家可以想象一下，如果在一次调用的过程中多次触发 state 的更新，则会做成 render 函数的多次触发，从而导致页面被迫渲染了多次，此时性能会大受影响。而在大多数情况下，一个事件调用了多次 setState ,其实我们只需要它渲染一次就足够了，所以这个类异步的操作，是 React 是内部性能优化的一种手段。而为什么在 setTimeout 里面调用，又是同步操作呢？我们接着看哈。

### 如何实现 setState 的类异步更新？
首先，看到 setTimeout 的时候，熟悉 js 事件循环机制的同学第一反应可能会以为它是采用了微任务的方式去处理，但其实不然，React 使用了一种在操作数据库中非常常用的机制去实现，该机制叫做事务机制，这个机制比直接使用微任务有更好的操控度.

### 最最最简单版事务（transaction）的实现
为什么使用最？因为重要的事情写三遍，实际的事务机制比我的实现复杂得多，所以我强调一下时最简单版，求生欲max，然后我们看看代码
```js
// 事务的实例
const transaction = {
    perform(fn) {
        this.initialAll()
        fn.call(app);
        this.close();
    },
    initialAll() {
        app.isBatchingUpdate = true;
        // do something
    },
    close() {
        app.isBatchingUpdate = false;
        app.updateState();
        // do something
    }
}
```
这就是事务的最简版，有点类似 express 的洋葱机制，有一个前置处理和后置处理。我们看一下代码，里面最关键的就是 perform 函数。事实上，我们在类中声明的 onClick 函数，在按钮点击时并没有立刻触发，而是作为 perform 函数的 fn 参数被传进来，所以就可以在 onClick 函数触发之前，做一些前置处理，比如把一个叫 isBatchingUpdate 的变量改为true. 那 isBatchingUpdate 这个变量是何方神圣呢? 我们继续看

### 变量锁 isBatchingUpdate 
这个变量锁就是我们实现批量更新的关键，React 会根据这个变量，决定是立刻更新 state 还是暂缓更新 state，上代码！
```js
// 记录有变化的组件
const dirtyComponent = new Set();
// 基类
class Component {
    // 批量更新的标识 也可称之为 变量锁，放这里是为了方便  大家不要太纠结细节，先弄懂原理
    isBatchingUpdate = false
    // 预处理状态 先默认 a 为 1
    preState = {
        a: 1
    }
    state = {
        a: 1
    }
    setState(changeState) {
        if (!this.isBatchingUpdate) {
            this.updateNow(changeState);
        } else {
            this.queueUpdate(changeState)
        }
    }
    // 最终版 更新状态
    updateState() {
        Object.assign(this.state, this.preState);
    }
    // 立刻更新
    updateNow(changeState) {
        Object.assign(this.preState, changeState);
        Object.assign(this.state, this.preState);
        this.render();
    }
    // 这里其实还可以传入函数  先展示最基本原理，后续再加上
    queueUpdate(changeState) {
        Object.assign(this.preState, changeState);
        dirtyComponent.add(this);
    }
}
```
这个是我模拟的一个 **React.Component** ,里面我简单实现了一下 setState，也就是批量更新的核心所在。这里的 **setState** 会判断当前是否处于批量更新的状态，如果是就先把状态更新到内部的预处理状态上 **preState**，**preState** 会先记着你的修改，同时把被修改了状态的组件，放入 **dirtyComponent** 内( **dirtyComponent** 不记得是数组还是集合了，为了方便先用集合吧)。然后就是我们正常的继承使用了。
```js
// 类组件
class App extends Component {
    state = {
        a: 1
    }
    onClick() {
        this.setState({ a: this.state.a + 1 });
        console.log('点击时 a 的值', this.state.a)
        this.setState({ a: this.state.a + 1 });
        console.log('点击时 a 的值', this.state.a);
        this.test();
    }
    test() {
        this.setState({ a: this.state.a + 1 });
        console.log('点击时 a 的值', this.state.a);
    }
    // 渲染函数 这里简单介绍哈，我们写的jsx，其实会经过这个过程：jsx -> React.createElement -> vnode  为了方便直接显示虚拟 dom 的最终数据结构
    render() {
        console.log('渲染时a的值', this.state.a);
        return {
            type: 'div',
            props: {
                id: "btn",
                children: [],
                onClick: () => this.onClick()
            }
        }
    }
}
```
**setState** 和 **transaction** 都模拟好了，就还差一步，就是模拟一下 React 的事件代理，这里就不做事件委托了，我直接监听点击的按钮哈，事件委托大家应该很熟悉了我就偷个懒不写了, 哈哈哈。
```js
// 构建实例 为了方便展示先挂载在window ，源码有另外保存的地方
window.app = new App();
// 获取虚拟 dom 节点
const vnode = app.render();
// 监听原生点击事件，react 自身实现了事件委托，但这里为了方便展示，直接在 dom 节点上监听事件
document.getElementById('btn').addEventListener('click', () => {
    // 事务包裹点击函数  react内部还有个找vnode的方法 和 匹配事件的方法 这里先省略
    transaction.perform(vnode.props.onClick);
    if (dirtyComponent.size !== 0) {
        dirtyComponent.forEach(component => component.render());
        dirtyComponent.clear();
    }
    // do something
})
```
可以看到当我们点击按钮时，React 会先找到我们注册的 **vnode** 和 **vnode** 内的对应事件，然后事务实例套着我们的 **onClick** 方法，从而在执行前，先把 **isBatchingUpdate** 这个变量锁打开。只要我们的方法没完成，由于变量锁的存在，就会一直让我们的修改只停留在 **preState** 内，一直不会更新到实际的 **state** 上。直到我们的方法执行完，事务的后置函数就会关闭我们的 **isBatchingUpdate**，同时把 **preState** 覆盖到我们实际的 **state** 上并执行渲染操作，至此整个批量更新就完成了。

## 总结
至此，迷你版的setState就实现了，这里主要是为了讲明白道理，可能有些细节与源码有点出入，但核心思想是一样的，大家有兴趣可以一起研究研究。

### 补充说明
#### Q: setTimeout 内为什么又会同步？
**A:** 前文说到 setTimeout 里面会同步是由于 setTimeout 会把里面的函数放到下一个宏任务内，这样就刚好跳出了事务的控制，就会显示出同步更新的情况。

#### Q: 为什么不用Promise.resolve().then() 去替代事务机制?
**A:** 我也看到很多文章直接用 Promise.resolve().then() 来模拟，但我觉得应该是不对的，在我看来这两者有本质的差异。Promise.resolve().then 是利用了微任务的原理进行延迟执行，这个延迟更新的时间就不太好控制了，如果当前宏任务内有一些耗时任务执行？如果又插入了其他微任务呢？而React 倡导的是函数式编程，函数式编程的思想是一切透明，可控，可预测。放入微任务明显颗粒度不足，可控性不强，我猜这才是 React 方面实现事务机制的根本原因。




