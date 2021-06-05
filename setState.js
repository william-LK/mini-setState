// 记录有变化的组件
const dirtyComponent = new Set();


// 父类
class Component {
    // 批量更新的标识 也可称之为 变量锁 react内部不是挂载在component上，这里也是为了方便  大家不要太纠结细节，先弄懂原理
    isBatchingUpdate = false
    // 预处理状态
    preState = {
        a: 1
    }
    setState(changeState) {
        if (!this.isBatchingUpdate) {
            this.updateNow(changeState);
        } else {
            this.queueUpdate(changeState)
        }
    }
    updateState() {
        Object.assign(this.state, this.preState);
    }
    updateNow(changeState) {
        Object.assign(this.preState, changeState);
        Object.assign(this.state, this.preState);
        dirtyComponent.add(this);
        this.render();
    }
    // 这里还可以传入函数  先展示最基本原理，后续再加上
    queueUpdate(changeState) {
        Object.assign(this.preState, changeState);
        dirtyComponent.add(this);
    }
}

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
    testSetTimeout() {
        setTimeout(() => {
            this.setState({
                a: this.state.a
            })
        }, 0)
    }
    componentDidmount() {
        // document.getElementById('btn').addEventListener('click', () => {
        //     this.setState({ a: this.state.a + 1});
        //     console.log(this.state.a,'点击')
        // })
    }
    // 渲染函数 jsx -> React.createElement -> vnode  为了方便直接显示虚拟 dom 的最终数据结构
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
// 构建实例 为了方便展示先挂载在window ， 源码有另外保存的地方
window.app = new App();
// 获取虚拟 dom 节点
const vnode = app.render();

// 事务的实例
const transaction = {
    perform(fn) {
        this.initialAll()
        fn.call(app);
        this.close();
    },
    initialAll() {
        app.isBatchingUpdate = true;
        // something to do
    },
    close() {
        app.isBatchingUpdate = false;
        app.updateState();
        // something to do
    }
}

// 监听原生点击事件，react 自身实现了事件委托，但这里为了方便展示，直接在 dom 节点上监听事件
document.getElementById('btn').addEventListener('click', () => {
    // 事务包裹点击函数  react内部还有个找vnode的方法 这里先省略
    transaction.perform(vnode.props.onClick);
    if (dirtyComponent.size !== 0) {
        dirtyComponent.forEach(component => component.render());
        dirtyComponent.clear();
    }
})
// 测试直接监听
app.componentDidmount();